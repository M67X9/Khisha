import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";

/**
 * Shown only when the app language is Arabic but the phone is still laying the screen out left to right
 * (or the reverse). Restarting the app applies the direction.
 */
export function DirectionBanner() {
  const { t, directionMismatch, restartForDirection } = useI18n();
  if (!directionMismatch) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="refresh-circle-outline" size={22} color={colors.statusConfirm} />
      <AppText variant="caption" style={{ flex: 1 }}>
        {t("direction.banner")}
      </AppText>
      <Pressable onPress={restartForDirection} accessibilityRole="button" style={styles.button}>
        <AppText variant="label" color={colors.textOnGradient}>
          {t("direction.restart")}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(168,95,0,0.12)", borderRadius: radius.md, padding: 12 },
  button: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
