import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../../../i18n";
import { getMemory, updateMemory } from "../../../../lib/memories";
import { useLoad } from "../../../../lib/useLoad";
import { AppText } from "../../../../ui/AppText";
import { Button } from "../../../../ui/Button";
import { MemoryForm, type MemoryFormValues } from "../../../../ui/MemoryForm";
import { ScreenHeader } from "../../../../ui/ScreenHeader";
import { colors } from "../../../../ui/theme";

export default function EditMemoryScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useLoad(() => getMemory(String(id)), [id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <ScreenHeader title={t("memory.editTitle")} />
      </View>
      {state.status === "loading" && <ActivityIndicator style={{ marginTop: 40 }} />}
      {state.status === "error" && (
        <View style={{ padding: 16, gap: 12 }}>
          <AppText variant="body" color={colors.statusError}>
            {t("memory.loadError")}
          </AppText>
          <Button label={t("memory.retry")} onPress={reload} />
        </View>
      )}
      {state.status === "ok" && state.data === null && (
        <View style={{ padding: 16 }}>
          <AppText variant="body">{t("memory.notFound")}</AppText>
        </View>
      )}
      {state.status === "ok" && state.data && (
        <MemoryForm
          initial={toFormValues(state.data)}
          submitLabel={t("memory.save")}
          onSubmit={async (input) => {
            await updateMemory(state.data!.id, input);
            router.back();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function toFormValues(m: NonNullable<Awaited<ReturnType<typeof getMemory>>>): MemoryFormValues {
  const amount = m.structured_fields?.amount;
  return {
    title: m.title,
    category: m.category,
    date: m.document_date ?? "",
    amount: typeof amount === "number" ? String(amount) : "",
    notes: m.notes ?? "",
  };
}
