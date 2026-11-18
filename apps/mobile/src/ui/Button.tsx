import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { AppText } from "./AppText";
import { colors, radius } from "./theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false }: Props) {
  const isPrimary = variant === "primary";
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, isPrimary ? styles.primary : styles.secondary, (pressed || inactive) && { opacity: inactive ? 0.5 : 0.85 }]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.textOnGradient : colors.ink} />
      ) : (
        <AppText variant="bodyStrong" color={isPrimary ? colors.textOnGradient : colors.ink} style={{ textAlign: "center" }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
