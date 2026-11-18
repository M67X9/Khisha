import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radius } from "./theme";

type Props = Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType" | "autoComplete" | "textContentType" | "returnKeyType" | "onSubmitEditing"> & {
  icon: "mail-outline" | "lock-closed-outline";
  /** shows a Show/Hide toggle and hides the text */
  secure?: boolean;
  accessibilityLabel: string;
};

export function TextField({ icon, secure = false, accessibilityLabel, ...input }: Props) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <TextInput
        {...input}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={hidden}
      />
      {secure && (
        <Pressable onPress={() => setHidden((h) => !h)} accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"} hitSlop={10}>
          <Text style={styles.toggle}>{hidden ? "Show" : "Hide"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgApp, borderRadius: radius.md, paddingHorizontal: 16, minHeight: 56 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
  toggle: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
});
