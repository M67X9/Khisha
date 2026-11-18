import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../i18n";
import { countMemories, listMemories } from "../../lib/memories";
import { useLoad } from "../../lib/useLoad";
import { AppText } from "../../ui/AppText";
import { CategoryCard } from "../../ui/CategoryCard";
import { FloatingBar } from "../../ui/FloatingBar";
import { IconButton } from "../../ui/IconButton";
import { MemoryRow } from "../../ui/MemoryRow";
import { colors, gradients, radius, shadowPanel } from "../../ui/theme";

/** Home (Figma: 2 · Home). Real data arrives in later milestones; the numbers here are placeholders. */
export default function HomeScreen() {
  const { t, lang, setLanguage, formatNumber } = useI18n();
  const { state } = useLoad(async () => {
    const [recent, receipts, movies] = await Promise.all([listMemories({ limit: 5 }), countMemories("receipt"), countMemories("movie")]);
    return { recent, receipts, movies };
  }, []);
  const data = state.status === "ok" ? state.data : null;
  const wordmark = lang === "ar" ? "خِشّه" : "Khisha";
  const secondary = lang === "ar" ? "Khisha" : "خِشّه";

  return (
    <View style={styles.root}>
      <LinearGradient colors={["rgba(181,139,224,0.38)", "rgba(238,238,240,0)"]} style={styles.glow} pointerEvents="none" />
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <View style={styles.nameRow}>
                <AppText variant="title">{wordmark}</AppText>
                <AppText variant="heading" color={colors.textSecondary}>
                  {secondary}
                </AppText>
              </View>
              <AppText variant="caption" color={colors.textSecondary}>
                {t("brand.tagline")}
              </AppText>
            </View>
            <View style={styles.actions}>
              <IconButton icon="globe-outline" onPress={() => setLanguage(lang === "ar" ? "en" : "ar")} accessibilityLabel={lang === "ar" ? "English" : "العربية"} />
              <IconButton icon="options-outline" onPress={() => router.push("/settings")} accessibilityLabel={t("settings.title")} />
            </View>
          </View>

          <Pressable onPress={() => router.push("/search")} accessibilityRole="search" accessibilityLabel={t("home.search")} style={styles.search}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <AppText variant="body" color={colors.textSecondary}>
              {t("home.search")}
            </AppText>
          </Pressable>

          <LinearGradient colors={[...gradients.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)"]} style={styles.heroScrim} pointerEvents="none" />
            <View style={styles.heroTop}>
              <AppText variant="label" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
                {t("home.nextDate")}
              </AppText>
              <View style={styles.chip}>
                <Ionicons name="sparkles" size={14} color={colors.textOnGradient} />
                <AppText variant="label" color={colors.textOnGradient}>
                  {t("home.credits", { n: formatNumber(200) })}
                </AppText>
              </View>
            </View>
            <View>
              <AppText variant="title" color={colors.textOnGradient}>
                {t("home.noDates")}
              </AppText>
              <AppText variant="body" color={colors.textOnGradient} style={{ opacity: 0.95 }}>
                {t("home.noDatesBody")}
              </AppText>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <AppText variant="heading" accessibilityRole="header">
              {t("home.categories")}
            </AppText>
            <Pressable onPress={() => router.push("/memories")} accessibilityRole="button" hitSlop={10}>
              <AppText variant="label" color={colors.textSecondary}>
                {t("home.seeAll")}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.cards}>
            <CategoryCard tone="coral" icon="receipt-outline" title={t("cat.receipts")} subtitle={t("cat.count", { n: formatNumber(data?.receipts ?? 0) })} onPress={() => router.push("/memories?category=receipt")} />
            <CategoryCard tone="violet" icon="film-outline" title={t("cat.movies")} subtitle={t("cat.count", { n: formatNumber(data?.movies ?? 0) })} onPress={() => router.push("/memories?category=movie")} />
          </View>

          <View style={styles.sectionHeader}>
            <AppText variant="heading" accessibilityRole="header">
              {t("home.recent")}
            </AppText>
            <Pressable onPress={() => router.push("/memories")} accessibilityRole="button" hitSlop={10}>
              <AppText variant="label" color={colors.textSecondary}>
                {t("home.seeAll")}
              </AppText>
            </Pressable>
          </View>
          {data && data.recent.length > 0 ? (
            <View style={{ gap: 10 }}>
              {data.recent.map((m) => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="documents-outline" size={28} color={colors.textSecondary} />
              <AppText variant="bodyStrong">{t("home.emptyTitle")}</AppText>
              <AppText variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>
                {t("home.emptyBody")}
              </AppText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <FloatingBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  safe: { flex: 1 },
  scroll: { padding: 16, gap: 16, paddingBottom: 140 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, minHeight: 52, ...shadowPanel },
  hero: { borderRadius: radius.lg, padding: 18, minHeight: 168, justifyContent: "space-between", overflow: "hidden" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 100 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cards: { flexDirection: "row", gap: 16 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 24, alignItems: "center", gap: 6, ...shadowPanel },
});
