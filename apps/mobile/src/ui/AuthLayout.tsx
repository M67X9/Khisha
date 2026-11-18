import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, gradients } from "./theme";

/** Gradient hero with the brand on top and a white sheet with the form at the bottom (matches the Figma Sign in screen). */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={[...gradients.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top"]} style={styles.brandWrap}>
          <Text style={styles.arabic}>خِشّه</Text>
          <Text style={styles.brand}>Khisha</Text>
          <Text style={styles.tagline}>Save it now, find it later</Text>
          <Text style={styles.tagline}>خِشّه الحين، تلقاه بعدين</Text>
        </SafeAreaView>
      </LinearGradient>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{title}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 430, paddingHorizontal: 24 },
  brandWrap: { paddingTop: 70, gap: 4 },
  arabic: { color: colors.textOnGradient, fontSize: 44, fontWeight: "600" },
  brand: { color: colors.textOnGradient, fontSize: 28, fontWeight: "600", opacity: 0.92 },
  tagline: { color: colors.textOnGradient, fontSize: 16, opacity: 0.92 },
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, gap: 14 },
  title: { fontSize: 28, fontWeight: "600", color: colors.ink },
});
