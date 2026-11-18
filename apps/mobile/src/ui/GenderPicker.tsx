import { GENDERS, type Gender } from "@khisha/shared";
import { Pressable, StyleSheet, View } from "react-native";

import { useI18n, type MessageKey } from "../i18n";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";

const LABELS: Record<Gender, MessageKey> = { male: "gender.male", female: "gender.female", unspecified: "gender.unspecified" };

/** Three-way choice. Picking one is optional in spirit: "Prefer not to say" keeps the original violet look. */
export function GenderPicker({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {GENDERS.map((g) => {
        const active = g === value;
        return (
          <Pressable key={g} onPress={() => onChange(g)} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.option, active && styles.optionActive]}>
            <AppText variant="label" color={active ? colors.textOnGradient : colors.ink} style={{ textAlign: "center" }} numberOfLines={2}>
              {t(LABELS[g])}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  option: { flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.bgApp, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 8 },
  optionActive: { backgroundColor: colors.ink },
});
