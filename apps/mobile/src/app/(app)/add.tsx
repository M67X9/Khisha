import { router } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../../i18n";
import { createMemory } from "../../lib/memories";
import { emptyMemoryForm, MemoryForm } from "../../ui/MemoryForm";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors } from "../../ui/theme";

/** Add a memory by hand. Uploading a screenshot or PDF replaces this as the main way in during milestone M4. */
export default function AddMemoryScreen() {
  const { t } = useI18n();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <ScreenHeader title={t("memory.addTitle")} />
      </View>
      <MemoryForm
        initial={emptyMemoryForm()}
        submitLabel={t("memory.save")}
        note={t("memory.manualNote")}
        onSubmit={async (input) => {
          const id = await createMemory(input);
          router.replace(`/memory/${id}`);
        }}
      />
    </SafeAreaView>
  );
}
