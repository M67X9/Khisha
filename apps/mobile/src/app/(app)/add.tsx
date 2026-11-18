import { Ionicons } from "@expo/vector-icons";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@khisha/shared";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../i18n";
import { pickDocument, pickPhoto, uploadFile, UploadFailure, type PickedFile, type PickResult, type UploadIssue } from "../../lib/upload";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, gradients, radius, shadowPanel } from "../../ui/theme";

type Phase = { name: "idle" } | { name: "picked"; file: PickedFile } | { name: "uploading"; file: PickedFile } | { name: "uploaded"; file: PickedFile };

const MB = 1024 * 1024;

/** Add Memory (Figma: 3 · Add Memory). Pick one file, check it, upload it to private storage. Reading it with AI comes in M5. */
export default function AddMemoryScreen() {
  const { t, formatNumber } = useI18n();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [issue, setIssue] = useState<UploadIssue | null>(null);

  const handlePick = async (picker: () => Promise<PickResult>) => {
    const result = await picker();
    if (result.status === "cancelled") return;
    if (result.status === "rejected") return setIssue(result.issue);
    setIssue(null);
    setPhase({ name: "picked", file: result.file });
  };

  const upload = async (file: PickedFile) => {
    setIssue(null);
    setPhase({ name: "uploading", file });
    try {
      await uploadFile(file);
      setPhase({ name: "uploaded", file });
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
  const busy = phase.name === "uploading";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("bar.add")} />

        {phase.name === "idle" && (
          <View style={styles.drop}>
            <LinearGradient colors={[...gradients.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
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

        {file && phase.name !== "uploaded" && <FileCard file={file} />}

        {phase.name === "uploaded" && (
          <View style={styles.success}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={26} color={colors.statusVerified} />
            </View>
            <AppText variant="heading" style={{ textAlign: "center" }}>
              {t("upload.doneTitle")}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
              {t("upload.doneBody")}
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
            <Button label={busy ? t("upload.uploading") : issue ? t("memory.retry") : t("upload.upload")} onPress={() => upload(phase.file)} loading={busy} />
            <Button label={t("upload.another")} variant="secondary" onPress={reset} disabled={busy} />
          </>
        )}

        {phase.name === "uploaded" && (
          <>
            <Button label={t("upload.done")} onPress={() => router.back()} />
            <Button label={t("upload.another")} variant="secondary" onPress={reset} />
          </>
        )}

        {phase.name === "idle" && (
          <>
            <View style={styles.note}>
              <Ionicons name="sparkles-outline" size={18} color={colors.violetStart} />
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
  return (
    <View style={styles.fileCard}>
      {file.kind === "image" ? (
        <Image source={{ uri: file.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.pdfThumb]}>
          <Ionicons name="document-text-outline" size={30} color={colors.violetStart} />
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
  pdfThumb: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tintViolet },
  success: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, gap: 10, alignItems: "center" },
  check: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tintVerified, alignItems: "center", justifyContent: "center" },
  issue: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(194,54,54,0.10)", borderRadius: radius.md, padding: 14 },
  note: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.tintViolet, borderRadius: radius.md, padding: 14 },
  manual: { alignItems: "center", paddingVertical: 8 },
});
