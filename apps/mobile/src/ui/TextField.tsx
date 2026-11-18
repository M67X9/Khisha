import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";
import { fontFamily } from "./typography";

type Props = Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType" | "autoComplete" | "textContentType" | "returnKeyType" | "onSubmitEditing"> & {
  icon: "mail-outline" | "lock-closed-outline";
  /** shows a Show/Hide toggle and hides the text */
  secure?: boolean;
  accessibilityLabel: string;
};

export function TextField({ icon, secure = false, accessibilityLabel, ...input }: Props) {
  const { lang, isRTL, t } = useI18n();
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <TextInput
        {...input}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" }]}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={hidden}
      />
      {secure && (
        <Pressable onPress={() => setHidden((h) => !h)} accessibilityRole="button" accessibilityLabel={hidden ? t("auth.showPassword") : t("auth.hidePassword")} hitSlop={10}>
          <AppText variant="label" color={colors.textSecondary}>
            {hidden ? t("auth.show") : t("auth.hide")}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgApp, borderRadius: radius.md, paddingHorizontal: 16, minHeight: 56 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
});
