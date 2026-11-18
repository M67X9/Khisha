import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { ScreenHeader } from "./ScreenHeader";
import { colors, radius } from "./theme";

/** Stand-in for a screen that is built in a later milestone. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <ScreenHeader title={title} />
        <View style={styles.panel}>
          <Ionicons name="construct-outline" size={32} color={colors.textSecondary} />
          <AppText variant="heading" style={{ textAlign: "center" }}>
            {t("soon.title")}
          </AppText>
          <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            {t("soon.body")}
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { flex: 1, padding: 16, gap: 16 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 24, gap: 8, alignItems: "center" },
});
