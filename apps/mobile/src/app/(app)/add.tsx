import { Ionicons } from "@expo/vector-icons";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@khisha/shared";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../i18n";
import { ExtractFailure, startExtraction, waitForExtraction } from "../../lib/extract";
import { pickDocument, pickPhoto, uploadFile, UploadFailure, type PickedFile, type PickResult, type UploadIssue } from "../../lib/upload";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius, shadowPanel } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";

type Phase =
  | { name: "idle" }
  | { name: "picked"; file: PickedFile }
  | { name: "uploading"; file: PickedFile }
  | { name: "extracting"; file: PickedFile; jobId: string }
  | { name: "extractFailed"; file: PickedFile; jobId: string };

const MB = 1024 * 1024;

/**
 * Add Memory (Figma: 3 · Add Memory). Pick one file, check it, upload it to private storage, then let the AI read it
 * into a draft memory. The draft then opens on the review screen (M6).
 */
export default function AddMemoryScreen() {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [issue, setIssue] = useState<UploadIssue | null>(null);
  const control = useRef({ cancelled: false });

  // If the person leaves this screen, stop waiting (the server keeps working; the draft is created either way).
  useEffect(() => {
    const c = control.current;
    return () => {
      c.cancelled = true;
    };
  }, []);

  const handlePick = async (picker: () => Promise<PickResult>) => {
    const result = await picker();
    if (result.status === "cancelled") return;
    if (result.status === "rejected") return setIssue(result.issue);
    setIssue(null);
    setPhase({ name: "picked", file: result.file });
  };

  const read = async (file: PickedFile, jobId: string) => {
    setIssue(null);
    setPhase({ name: "extracting", file, jobId });
    try {
      await startExtraction(jobId);
      const { memoryId } = await waitForExtraction(jobId, control.current);
      if (!control.current.cancelled) router.replace(`/review/${memoryId}`);
    } catch (e) {
      if (control.current.cancelled) return;
      setIssue(e instanceof ExtractFailure ? e.issue : { key: "extract.err.generic" });
      setPhase({ name: "extractFailed", file, jobId });
    }
  };

  const upload = async (file: PickedFile) => {
    setIssue(null);
    setPhase({ name: "uploading", file });
    try {
      const { jobId } = await uploadFile(file);
      await read(file, jobId);
    } catch (e) {
      setIssue(e instanceof UploadFailure ? e.issue : { key: "upload.err.server" });
      setPhase({ name: "picked", file }); // keep the file so the person can try again
    }
  };

  const reset = () => {
    setIssue(null);
    setPhase({ name: "idle" });
  };

  const limits = t("upload.limits", { image: formatNumber(MAX_IMAGE_BYTES / MB), pdf: formatNumber(MAX_PDF_BYTES / MB), pages: formatNumber(MAX_PDF_PAGES) });
  const file = phase.name === "idle" ? null : phase.file;
  const uploading = phase.name === "uploading";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("bar.add")} />

        {phase.name === "idle" && (
          <View style={styles.drop}>
            <LinearGradient colors={[...theme.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.textOnGradient} />
            </LinearGradient>
            <AppText variant="heading" style={{ textAlign: "center" }}>
              {t("upload.heading")}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>
              {limits}
            </AppText>
          </View>
        )}

        {file && <FileCard file={file} />}

        {phase.name === "extracting" && (
          <View style={styles.reading}>
            <ActivityIndicator size="large" color={theme.accent} />
            <AppText variant="heading" style={{ textAlign: "center" }}>
              {t("extract.reading")}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
              {t("extract.readingBody")}
            </AppText>
          </View>
        )}

        {issue && (
          <View style={styles.issue} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={20} color={colors.statusError} />
            <AppText variant="label" color={colors.statusError} style={{ flex: 1 }}>
              {t(issue.key, issue.params)}
            </AppText>
          </View>
        )}

        {phase.name === "idle" && (
          <>
            <Button label={t("upload.choose")} onPress={() => handlePick(pickDocument)} />
            <Button label={t("upload.photos")} variant="secondary" onPress={() => handlePick(pickPhoto)} />
          </>
        )}

        {(phase.name === "picked" || phase.name === "uploading") && (
          <>
            <Button label={uploading ? t("upload.uploading") : issue ? t("memory.retry") : t("upload.upload")} onPress={() => upload(phase.file)} loading={uploading} />
            <Button label={t("upload.another")} variant="secondary" onPress={reset} disabled={uploading} />
          </>
        )}

        {phase.name === "extractFailed" && (
          <>
            <Button label={t("extract.retry")} onPress={() => read(phase.file, phase.jobId)} />
            <Button label={t("upload.another")} variant="secondary" onPress={reset} />
            <Pressable onPress={() => router.replace("/add-manual")} accessibilityRole="button" style={styles.manual}>
              <AppText variant="label" color={colors.textSecondary}>
                {t("upload.manual")}
              </AppText>
            </Pressable>
          </>
        )}

        {phase.name === "idle" && (
          <>
            <View style={[styles.note, { backgroundColor: theme.tint }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {t("upload.credit")}
              </AppText>
            </View>
            <Pressable onPress={() => router.push("/add-manual")} accessibilityRole="button" style={styles.manual}>
              <AppText variant="label" color={colors.textSecondary}>
                {t("upload.manual")}
              </AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FileCard({ file }: { file: PickedFile }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={styles.fileCard}>
      {file.kind === "image" ? (
        <Image source={{ uri: file.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.pdfThumb, { backgroundColor: theme.tint }]}>
          <Ionicons name="document-text-outline" size={30} color={theme.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {file.name}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {file.kind === "pdf" ? t("upload.kindPdf") : t("upload.kindImage")} · {t("upload.sizeMb", { size: (file.size / MB).toFixed(1) })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  drop: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, gap: 14, alignItems: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, minHeight: 300, justifyContent: "center" },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, ...shadowPanel },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.bgApp },
  pdfThumb: { alignItems: "center", justifyContent: "center" },
  reading: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, gap: 12, alignItems: "center" },
  issue: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(194,54,54,0.10)", borderRadius: radius.md, padding: 14 },
  note: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.md, padding: 14 },
  manual: { alignItems: "center", paddingVertical: 8 },
});
