import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type Lang } from "../../i18n";
import { useAuth } from "../../lib/auth";
import { AppText } from "../../ui/AppText";
import { DirectionBanner } from "../../ui/DirectionBanner";
import { Button } from "../../ui/Button";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius, shadowPanel } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";

/** Settings (Figma: 11 · Settings). Usage numbers are demo values until milestone M10. */
export default function SettingsScreen() {
  const { t, lang, isRTL, setLanguage, formatNumber } = useI18n();
  const theme = useTheme();
  const { session, profile, profileError, signOut } = useAuth();
  const email = session?.user.email ?? "";
  const shownName = profile?.display_name || email;
  const initial = (Array.from(shownName)[0] ?? "?").toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("settings.title")} />
        <DirectionBanner />

        <View style={styles.account}>
          <LinearGradient colors={[...theme.gradient]} style={styles.avatar}>
            <AppText variant="heading" color={colors.textOnGradient}>
              {initial}
            </AppText>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {shownName}
            </AppText>
            <AppText variant="caption" color={profile ? colors.statusVerified : profileError ? colors.statusError : colors.textSecondary}>
              {t("settings.profile")}: {profile ? t("settings.profileOk") : profileError ? t("settings.profileMissing") : t("settings.profileLoading")}
            </AppText>
          </View>
          <View style={[styles.planChip, { backgroundColor: theme.tint }]}>
            <AppText variant="label" color={theme.accent}>
              {t("settings.freePlan")}
            </AppText>
          </View>
        </View>

        <LinearGradient colors={[...theme.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.usage, { borderRadius: theme.heroRadius }]}>
          <AppText variant="heading" color={colors.textOnGradient}>
            {t("settings.usage")}
          </AppText>
          <Meter label={t("settings.credits")} value={t("settings.creditsValue", { left: formatNumber(200), total: formatNumber(200) })} fraction={1} />
          <Meter label={t("settings.storage")} value={t("settings.storageValue", { used: formatNumber(0), total: formatNumber(100) })} fraction={0.02} />
          <AppText variant="caption" color={colors.textOnGradient} style={{ opacity: 0.9 }}>
            {t("settings.demoNote")}
          </AppText>
        </LinearGradient>

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("settings.language")}
          </AppText>
          <View style={styles.segmented}>
            <Segment label={t("settings.langEnglish")} active={lang === "en"} onPress={() => setLanguage("en" satisfies Lang)} />
            <Segment label={t("settings.langArabic")} active={lang === "ar"} onPress={() => setLanguage("ar" satisfies Lang)} />
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            {t("settings.langNote")}
          </AppText>
        </View>

        <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" style={styles.row}>
          <Ionicons name="person-outline" size={20} color={theme.accent} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t("settings.yourProfile")}
          </AppText>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable onPress={() => router.push("/status")} accessibilityRole="button" style={styles.row}>
          <Ionicons name="pulse-outline" size={20} color={theme.accent} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t("settings.connection")}
          </AppText>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
        </Pressable>

        <Button label={t("settings.signOut")} variant="secondary" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Meter({ label, value, fraction }: { label: string; value: string; fraction: number }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.meterTop}>
        <AppText variant="label" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" color={colors.textOnGradient}>
          {value}
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, Math.round(fraction * 100))}%` }]} />
      </View>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.segment, active && styles.segmentActive]}>
      <AppText variant="label" color={active ? colors.textOnGradient : colors.textSecondary} style={{ textAlign: "center" }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  account: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, ...shadowPanel },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  planChip: { backgroundColor: colors.tintViolet, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  usage: { borderRadius: radius.lg, padding: 20, gap: 16 },
  meterTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden", flexDirection: "row" },
  fill: { height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  group: { gap: 8 },
  segmented: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, borderRadius: radius.pill, paddingVertical: 11, alignItems: "center" },
  segmentActive: { backgroundColor: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, ...shadowPanel },
});
