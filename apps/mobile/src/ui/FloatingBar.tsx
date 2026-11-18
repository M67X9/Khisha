import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { colors, gradients, radius } from "./theme";

/**
 * Floating action bar (Figma: Floating Bar): Search, Add Memory, Ask AI.
 * The row flips automatically in right-to-left mode.
 */
export function FloatingBar() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="light" style={styles.bar}>
        <View style={styles.overlay} />
        <Pressable onPress={() => router.push("/search")} accessibilityRole="button" accessibilityLabel={t("bar.search")} style={styles.round}>
          <Ionicons name="search" size={22} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => router.push("/add")} accessibilityRole="button" accessibilityLabel={t("bar.add")} style={styles.add}>
          <LinearGradient colors={[...gradients.violet]} style={styles.plus}>
            <Ionicons name="add" size={18} color={colors.textOnGradient} />
          </LinearGradient>
          <AppText variant="bodyStrong" color={colors.textOnGradient}>
            {t("bar.add")}
          </AppText>
        </Pressable>
        <Pressable onPress={() => router.push("/ask")} accessibilityRole="button" accessibilityLabel={t("bar.ask")}>
          <LinearGradient colors={[...gradients.violet]} style={styles.round}>
            <Ionicons name="sparkles" size={22} color={colors.textOnGradient} />
          </LinearGradient>
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: radius.pill, overflow: "hidden" },
  overlay: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: "rgba(255,255,255,0.82)" },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  add: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 10, paddingStart: 10, paddingEnd: 20 },
  plus: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
