import { Ionicons } from "@expo/vector-icons";
import { MEMORY_CATEGORIES, type MemorySummary } from "@khisha/shared";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../i18n";
import { toISODate } from "../../lib/dates";
import { searchMemories, type SearchFilters } from "../../lib/memories";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { metaFor } from "../../ui/categories";
import { MemoryRow } from "../../ui/MemoryRow";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius, shadowPanel } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { fontFamily } from "../../ui/typography";

type Range = "any" | "7" | "30" | "year";
const RANGES: { key: Range; label: MessageKey }[] = [
  { key: "any", label: "search.anyTime" },
  { key: "7", label: "search.days7" },
  { key: "30", label: "search.days30" },
  { key: "year", label: "search.thisYear" },
];

function rangeDates(range: Range): { from: string | null; to: string | null } {
  const now = new Date();
  if (range === "any") return { from: null, to: null };
  if (range === "year") return { from: `${now.getFullYear()}-01-01`, to: toISODate(now) };
  const start = new Date(now);
  start.setDate(start.getDate() - Number(range));
  return { from: toISODate(start), to: toISODate(now) };
}

type State = { status: "loading" } | { status: "error" } | { status: "ok"; items: MemorySummary[] };

/** Search (Figma: Search): type words, narrow by category and date. Free: it never uses AI or credits. */
export default function SearchScreen() {
  const { t, lang, isRTL, isArabic, formatNumber } = useI18n();
  const theme = useTheme();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("any");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => (s.status === "ok" ? s : { status: "loading" }));
    // Wait a moment after the last keystroke so each letter does not hit the server.
    const timer = setTimeout(async () => {
      const filters: SearchFilters = { category, ...rangeDates(range) };
      try {
        const items = await searchMemories(text, filters);
        if (id === latest.current) setState({ status: "ok", items });
      } catch {
        if (id === latest.current) setState({ status: "error" });
      }
    }, text ? 300 : 0);
    return () => clearTimeout(timer);
  }, [text, category, range, attempt]);

  const filtered = text.trim() !== "" || category !== null || range !== "any";
  const inputStyle = [styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: (isRTL ? "right" : "left") as "left" | "right", writingDirection: (isArabic ? "rtl" : "ltr") as "rtl" | "ltr" }];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("bar.search")} />

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel={t("search.placeholder")}
            style={inputStyle}
            value={text}
            onChangeText={setText}
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            maxLength={200}
          />
          {text !== "" && (
            <Pressable onPress={() => setText("")} accessibilityRole="button" accessibilityLabel={t("search.clear")} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t("search.allCategories")} active={category === null} onPress={() => setCategory(null)} />
          {MEMORY_CATEGORIES.map((key) => (
            <Chip key={key} label={t(metaFor(key).label)} active={category === key} onPress={() => setCategory(category === key ? null : key)} />
          ))}
        </ScrollView>

        <View style={styles.segment}>
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable key={r.key} onPress={() => setRange(r.key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.segItem, active && { backgroundColor: colors.ink }]}>
                <AppText variant="caption" color={active ? colors.textOnGradient : colors.ink} numberOfLines={1}>
                  {t(r.label)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {state.status === "loading" && <ActivityIndicator style={{ marginTop: 24 }} color={theme.accent} />}
        {state.status === "error" && (
          <View style={{ gap: 12 }}>
            <AppText variant="body" color={colors.statusError}>
              {t("search.err")}
            </AppText>
            <Button label={t("memory.retry")} onPress={() => setAttempt((a) => a + 1)} />
          </View>
        )}
        {state.status === "ok" && state.items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={colors.textSecondary} />
            <AppText variant="heading" style={{ textAlign: "center" }}>
              {filtered ? t("search.none") : t("search.empty")}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
              {filtered ? t("search.noneBody") : t("search.emptyBody")}
            </AppText>
          </View>
        )}
        {state.status === "ok" && state.items.length > 0 && (
          <>
            {filtered && (
              <AppText variant="label" color={colors.textSecondary}>
                {t("search.results", { count: formatNumber(state.items.length) })}
              </AppText>
            )}
            <View style={{ gap: 10 }}>
              {state.items.map((m) => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
      <AppText variant="label" color={active ? colors.textOnGradient : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 14, paddingBottom: 40 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, minHeight: 52, ...shadowPanel },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: radius.pill },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40 },
});
