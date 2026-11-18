import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";

/** Glass chip that switches the app language. Shows the language you would switch to. */
export function LanguageChip() {
  const { lang, setLanguage } = useI18n();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <Pressable onPress={() => setLanguage(next)} accessibilityRole="button" accessibilityLabel={next === "ar" ? "العربية" : "English"} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}>
      <Ionicons name="globe-outline" size={16} color={colors.textOnGradient} />
      <AppText variant="label" color={colors.textOnGradient}>
        {next === "ar" ? "العربية" : "English"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke },
});
