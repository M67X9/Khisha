import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";

import { useI18n } from "../i18n";
import { AppText } from "./AppText";
import { colors, gradients, radius } from "./theme";

type Props = {
  tone: Exclude<keyof typeof gradients, "violet"> | "violet";
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress?: () => void;
};

function GlassCircle({ children }: { children: React.ReactNode }) {
  return <View style={styles.glass}>{children}</View>;
}

/** Gradient category card (Figma: Gradient/Card). */
export function CategoryCard({ tone, icon, title, subtitle, onPress }: Props) {
  const { isRTL } = useI18n();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.9 }]}>
      <LinearGradient colors={[...gradients[tone]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.32)"]} style={styles.scrim} pointerEvents="none" />
        <View style={styles.top}>
          <GlassCircle>
            <Ionicons name={icon} size={18} color={colors.textOnGradient} />
          </GlassCircle>
          <GlassCircle>
            <Ionicons name="arrow-forward" size={16} color={colors.textOnGradient} style={{ transform: [{ rotate: isRTL ? "225deg" : "-45deg" }] }} />
          </GlassCircle>
        </View>
        <View>
          <AppText variant="heading" color={colors.textOnGradient}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.textOnGradient} style={{ opacity: 0.92 }}>
            {subtitle}
          </AppText>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1 },
  card: { height: 176, borderRadius: radius.lg, padding: 16, justifyContent: "space-between", overflow: "hidden" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 96 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  glass: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke },
});
