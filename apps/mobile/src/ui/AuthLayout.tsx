import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { DirectionBanner } from "./DirectionBanner";
import { LanguageChip } from "./LanguageChip";
import { colors } from "./theme";
import { useTheme } from "./ThemeProvider";

/** Gradient hero with the brand on top and a white sheet with the form at the bottom (matches the Figma Sign in screen). */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <LinearGradient colors={[...theme.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <View style={styles.chipRow}>
            <LanguageChip />
          </View>
          <View style={styles.brandWrap}>
            <AppText variant="number" color={colors.textOnGradient} style={{ fontSize: 44, lineHeight: 56 }}>
              {lang === "ar" ? "خِشّه" : "Khisha"}
            </AppText>
            <AppText variant="title" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
              {lang === "ar" ? "Khisha" : "خِشّه"}
            </AppText>
            <AppText variant="body" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
              {t("brand.tagline")}
            </AppText>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.sheet}>
            <DirectionBanner />
            <AppText variant="title">{title}</AppText>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 430, paddingHorizontal: 24 },
  heroSafe: { flex: 1 },
  chipRow: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 8 },
  brandWrap: { marginTop: 56, gap: 2, alignItems: "flex-start" },
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, gap: 14 },
});
