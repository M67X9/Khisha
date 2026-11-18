import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { Button } from "../../ui/Button";
import { colors, gradients, radius } from "../../ui/theme";

/** Placeholder Home for milestone M1: proves sign-in worked and the profile row exists. The real Home comes in M2. */
export default function HomeScreen() {
  const { session, profile, profileError, signOut } = useAuth();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <LinearGradient colors={[...gradients.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>Signed in as</Text>
          <Text style={styles.heroEmail}>{session?.user.email}</Text>
        </LinearGradient>

        <View style={styles.panel}>
          <Text style={styles.heading}>Your account</Text>
          <Row label="Profile" value={profile ? "✓ Created" : profileError ? "✕ Not found" : "Loading…"} good={Boolean(profile)} bad={profileError} />
          <Row label="Language" value={profile ? (profile.preferred_language === "ar" ? "العربية" : "English") : "—"} />
          <Row label="Plan" value="Free (demo)" />
        </View>

        <Button label="Connection check" variant="secondary" onPress={() => router.push("/status")} />
        <Button label="Sign out" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, good && { color: colors.statusVerified }, bad && { color: colors.statusError }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { flex: 1, padding: 16, gap: 16 },
  hero: { borderRadius: radius.lg, padding: 24, gap: 4 },
  heroLabel: { color: colors.textOnGradient, opacity: 0.92, fontSize: 14 },
  heroEmail: { color: colors.textOnGradient, fontSize: 22, fontWeight: "600" },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: "600", color: colors.ink },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 16, color: colors.textSecondary },
  rowValue: { fontSize: 16, fontWeight: "600", color: colors.ink },
});
