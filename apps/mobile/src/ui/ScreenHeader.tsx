import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";

/** Back button on the start side, centered title, empty space on the end side. */
export function ScreenHeader({ title }: { title: string }) {
  const { t, isRTL } = useI18n();
  return (
    <View style={styles.row}>
      <IconButton icon={isRTL ? "chevron-forward" : "chevron-back"} onPress={() => router.back()} accessibilityLabel={t("common.back")} />
      <AppText variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spacer: { width: 44, height: 44 },
});
