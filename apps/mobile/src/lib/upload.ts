import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "@khisha/shared";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { MessageKey } from "../i18n";
import { supabase } from "./supabase";

const MB = 1024 * 1024;

export type FileMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** A file the person picked and that passed the checks on the phone. */
export type PickedFile = { uri: string; name: string; mimeType: FileMime; size: number; kind: "image" | "pdf" };

/** Something to tell the person, as a message key plus values for its placeholders. */
export type UploadIssue = { key: MessageKey; params?: Record<string, string | number> };

export type PickResult = { status: "picked"; file: PickedFile } | { status: "cancelled" } | { status: "rejected"; issue: UploadIssue };

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

const mbText = (bytes: number) => (bytes / MB).toFixed(1);

async function readSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

/** Checks type and size, and turns HEIC photos into JPEG, before anything is uploaded. */
async function checkPicked(uri: string, name: string, reportedMime: string | undefined, reportedSize: number | undefined): Promise<PickResult> {
  const reported = reportedMime?.toLowerCase();
  const mime = reported && reported !== "application/octet-stream" ? reported : EXTENSION_MIME[extensionOf(name)];
  const typeLabel = (extensionOf(name) || reported || "?").toUpperCase();
  if (!mime || !(mime === "application/pdf" || mime.startsWith("image/"))) return { status: "rejected", issue: { key: "upload.err.type", params: { type: typeLabel } } };

  let finalUri = uri;
  let finalName = name;
  let finalMime = mime;
  let size = reportedSize;

  if (mime === "image/heic" || mime === "image/heif") {
    try {
      const rendered = await ImageManipulator.manipulate(uri).renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      finalUri = saved.uri;
      finalName = `${name.replace(/\.[^.]+$/, "")}.jpg`;
      finalMime = "image/jpeg";
      size = undefined; // the converted file has a new size
    } catch {
      return { status: "rejected", issue: { key: "upload.err.read" } };
    }
  } else if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp" && mime !== "application/pdf") {
    return { status: "rejected", issue: { key: "upload.err.type", params: { type: typeLabel } } };
  }

  try {
    if (size === undefined || size === null) size = await readSize(finalUri);
  } catch {
    return { status: "rejected", issue: { key: "upload.err.read" } };
  }

  if (size <= 0) return { status: "rejected", issue: { key: "upload.err.empty" } };
  const kind = finalMime === "application/pdf" ? "pdf" : "image";
  const limit = kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (size > limit) return { status: "rejected", issue: { key: "upload.err.size", params: { size: mbText(size), limit: mbText(limit) } } };

  return { status: "picked", file: { uri: finalUri, name: finalName, mimeType: finalMime as FileMime, size, kind } };
}

export async function pickDocument(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return { status: "cancelled" };
  const a = result.assets[0];
  return checkPicked(a.uri, a.name, a.mimeType, a.size);
}

export async function pickPhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "rejected", issue: { key: "upload.err.permission" } };
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
  if (result.canceled) return { status: "cancelled" };
  const a = result.assets[0];
  return checkPicked(a.uri, a.fileName ?? `photo-${Date.now()}.jpg`, a.mimeType, a.fileSize);
}

export class UploadFailure extends Error {
  constructor(public issue: UploadIssue) {
    super(issue.key);
  }
}

function issueForServerCode(code: string, file: PickedFile): UploadIssue {
  switch (code) {
    case "unsupported_type":
    case "type_mismatch":
      return { key: "upload.err.type", params: { type: file.mimeType } };
    case "too_large": {
      const limit = file.kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      return { key: "upload.err.size", params: { size: mbText(file.size), limit: mbText(limit) } };
    }
    case "empty":
      return { key: "upload.err.empty" };
    case "too_many_pending":
      return { key: "upload.err.pending" };
    case "network":
      return { key: "upload.err.network" };
    default:
      return { key: "upload.err.server" };
  }
}

async function callUpload<T>(body: Record<string, unknown>, file: PickedFile): Promise<T> {
  const { data, error } = await supabase.functions.invoke("upload", { body });
  if (error) {
    let code = "server_error";
    if (error instanceof FunctionsFetchError) code = "network";
    else if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as { error?: string };
        code = payload.error ?? "server_error";
      } catch {
        code = "server_error";
      }
    }
    throw new UploadFailure(issueForServerCode(code, file));
  }
  return data as T;
}

/**
 * Uploads a checked file to the private temporary bucket:
 * 1) ask the server for permission and a one-time upload token, 2) send the bytes, 3) ask the server to verify them.
 * The server re-checks the type and size, so the checks on the phone are only a convenience.
 */
export async function uploadFile(file: PickedFile): Promise<{ fileId: string; jobId: string | null }> {
  const prepared = await callUpload<{ file_id: string; job_id: string; path: string; token: string }>(
    { action: "prepare", filename: file.name, mime_type: file.mimeType, size_bytes: file.size },
    file,
  );

  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(file.uri)).arrayBuffer();
  } catch {
    throw new UploadFailure({ key: "upload.err.read" });
  }

  const { error } = await supabase.storage.from("temp-uploads").uploadToSignedUrl(prepared.path, prepared.token, bytes, { contentType: file.mimeType });
  if (error) throw new UploadFailure(/exceed|too large|size/i.test(error.message) ? issueForServerCode("too_large", file) : { key: "upload.err.network" });

  const done = await callUpload<{ file_id: string; job_id: string | null }>({ action: "complete", file_id: prepared.file_id }, file);
  return { fileId: done.file_id, jobId: done.job_id };
}
