import { Ionicons } from "@expo/vector-icons";
import type { MemorySummary } from "@khisha/shared";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useI18n } from "../i18n";
import { formatAmount } from "../lib/format";
import { AppText } from "./AppText";
import { metaFor } from "./categories";
import { colors, gradients, radius, shadowPanel } from "./theme";

/** One memory in a list (Figma: Memory/Row). */
export function MemoryRow({ memory }: { memory: MemorySummary }) {
  const { t, formatDate } = useI18n();
  const meta = metaFor(memory.category);
  const amount = formatAmount(t, memory.structured_fields);
  const date = memory.document_date ?? memory.created_at;
  return (
    <Pressable
      onPress={() => router.push(`/memory/${memory.id}`)}
      accessibilityRole="button"
      accessibilityLabel={memory.title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <LinearGradient colors={[...gradients[meta.tone]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
        <Ionicons name={meta.icon} size={22} color={colors.textOnGradient} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {memory.title}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {t(meta.label)} · {formatDate(date)}
        </AppText>
      </View>
      {amount && <AppText variant="bodyStrong">{amount}</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, ...shadowPanel },
  tile: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
