/**
 * File limits for uploads (see docs/PLAN.md, "File limits").
 * The app, the Storage bucket settings and the `extract` Edge Function must all agree with these values.
 */
export const MAX_FILES_PER_UPLOAD = 1;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PDF_PAGES = 10;

/** HEIC is converted to JPEG on the phone before upload, so the server only sees JPEG/PNG/WebP/PDF. */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_PICKER_IMAGE_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, "image/heic", "image/heif"] as const;
export const ALLOWED_PDF_MIME_TYPE = "application/pdf" as const;

/** Temporary uploads that are never saved are deleted after this long. */
export const TEMP_UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour
