import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../i18n";
import { listMemories } from "../../lib/memories";
import { useLoad } from "../../lib/useLoad";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { metaFor } from "../../ui/categories";
import { MemoryRow } from "../../ui/MemoryRow";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius } from "../../ui/theme";

/** All memories, newest first. With ?category=receipt it shows one category (opened from the Home category cards). */
export default function MemoriesScreen() {
  const { t } = useI18n();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { state, reload } = useLoad(() => listMemories({ limit: 100, category }), [category]);
  const title = category ? t(metaFor(category).label) : t("memories.title");

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={title} />
        {state.status === "loading" && <ActivityIndicator style={{ marginTop: 40 }} />}
        {state.status === "error" && (
          <View style={{ gap: 12 }}>
            <AppText variant="body" color={colors.statusError}>
              {t("memory.loadError")}
            </AppText>
            <Button label={t("memory.retry")} onPress={reload} />
          </View>
        )}
        {state.status === "ok" && state.data.length === 0 && (
          <View style={styles.empty}>
            <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
              {t("memories.empty")}
            </AppText>
          </View>
        )}
        {state.status === "ok" && state.data.map((m) => <MemoryRow key={m.id} memory={m} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 24 },
});
