import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../../../i18n";
import { formatAmount } from "../../../../lib/format";
import { getMemory, softDeleteMemory } from "../../../../lib/memories";
import { useLoad } from "../../../../lib/useLoad";
import { AppText } from "../../../../ui/AppText";
import { Button } from "../../../../ui/Button";
import { metaFor } from "../../../../ui/categories";
import { ScreenHeader } from "../../../../ui/ScreenHeader";
import { colors, gradients, radius, shadowPanel } from "../../../../ui/theme";
import { useTheme } from "../../../../ui/ThemeProvider";

const SOURCE_KEYS: Record<string, MessageKey> = {
  manual: "memory.sourceManual",
  screenshot: "memory.sourceScreenshot",
  image: "memory.sourceImage",
  pdf: "memory.sourcePdf",
};

/** Memory Detail (Figma: 5 · Memory Detail): a compact summary that expands into more detail. */
export default function MemoryDetailScreen() {
  const { t, formatDate } = useI18n();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useLoad(() => getMemory(String(id)), [id]);
  const [expanded, setExpanded] = useState(false);

  const confirmDelete = () => {
    Alert.alert(t("memory.deleteTitle"), t("memory.deleteBody"), [
      { text: t("memory.cancel"), style: "cancel" },
      {
        text: t("memory.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await softDeleteMemory(String(id));
            router.back();
          } catch {
            Alert.alert(t("memory.err.delete"));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("memory.title")} />

        {state.status === "loading" && <ActivityIndicator style={{ marginTop: 40 }} />}
        {state.status === "error" && (
          <View style={{ gap: 12 }}>
            <AppText variant="body" color={colors.statusError}>
              {t("memory.loadError")}
            </AppText>
            <Button label={t("memory.retry")} onPress={reload} />
          </View>
        )}
        {state.status === "ok" && state.data === null && <AppText variant="body">{t("memory.notFound")}</AppText>}

        {state.status === "ok" && state.data && (() => {
          const m = state.data;
          const meta = metaFor(m.category);
          const amount = formatAmount(t, m.structured_fields);
          const date = m.document_date ? formatDate(m.document_date) : null;
          const extraFields = Object.entries(m.structured_fields ?? {}).filter(([k]) => k !== "amount" && k !== "currency");
          const verified = m.verification === "verified";
          return (
            <>
              <LinearGradient colors={[...gradients[meta.tone]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.32)"]} style={styles.scrim} pointerEvents="none" />
                <View style={styles.chip}>
                  <Ionicons name={meta.icon} size={14} color={colors.textOnGradient} />
                  <AppText variant="label" color={colors.textOnGradient}>
                    {t(meta.label)}
                  </AppText>
                </View>
                <View>
                  <AppText variant="heading" color={colors.textOnGradient} numberOfLines={3}>
                    {m.title}
                  </AppText>
                  {amount && (
                    <AppText variant="number" color={colors.textOnGradient}>
                      {amount}
                    </AppText>
                  )}
                  {date && (
                    <AppText variant="caption" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
                      {date}
                    </AppText>
                  )}
                </View>
              </LinearGradient>

              <View style={[styles.pill, verified ? styles.pillOk : styles.pillNeutral]}>
                <Ionicons name={verified ? "checkmark" : "information-circle-outline"} size={14} color={verified ? colors.statusVerified : colors.textSecondary} />
                <AppText variant="label" color={verified ? colors.statusVerified : colors.textSecondary}>
                  {verified ? t("memory.verified") : t("memory.unverified")}
                </AppText>
              </View>

              <View style={styles.panel}>
                {date && <KeyValue label={t("memory.date")} value={date} />}
                <KeyValue label={t("memory.category")} value={t(meta.label)} />
                <KeyValue label={t("memory.saved")} value={formatDate(m.created_at)} />
              </View>

              {m.notes && (
                <View style={styles.panel}>
                  <AppText variant="label" color={colors.textSecondary}>
                    {t("memory.notes")}
                  </AppText>
                  <AppText variant="body">{m.notes}</AppText>
                </View>
              )}

              <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle}>
                <AppText variant="label" color={theme.accent}>
                  {expanded ? t("memory.showLess") : t("memory.showMore")}
                </AppText>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.accent} />
              </Pressable>

              {expanded && (
                <View style={styles.panel}>
                  <KeyValue label={t("memory.source")} value={t(SOURCE_KEYS[m.source_type] ?? "memory.sourceManual")} />
                  {extraFields.map(([k, v]) => (
                    <KeyValue key={k} label={k} value={String(v)} />
                  ))}
                  {m.extracted_text && (
                    <View style={{ gap: 4 }}>
                      <AppText variant="label" color={colors.textSecondary}>
                        {t("memory.moreText")}
                      </AppText>
                      <AppText variant="body">{m.extracted_text}</AppText>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button label={t("memory.edit")} variant="secondary" onPress={() => router.push(`/memory/${m.id}/edit`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={confirmDelete} accessibilityRole="button" accessibilityLabel={t("memory.delete")} style={styles.delete}>
                    <AppText variant="bodyStrong" color={colors.statusError} style={{ textAlign: "center" }}>
                      {t("memory.delete")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <AppText variant="label" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { borderRadius: radius.lg, padding: 18, minHeight: 176, justifyContent: "space-between", overflow: "hidden" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 110 },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  pillOk: { backgroundColor: colors.tintVerified },
  pillNeutral: { backgroundColor: "rgba(107,107,118,0.13)" },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 12, ...shadowPanel },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  actions: { flexDirection: "row", gap: 12 },
  delete: { minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
