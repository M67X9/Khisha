import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { checkHealth, type HealthState } from "../lib/health";

/** M0 status screen: proves the app can reach the Supabase Edge Function and the database. */
export default function StatusScreen() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  const run = useCallback(async () => {
    setHealth({ status: "loading" });
    setHealth(await checkHealth());
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const fnOk = health.status === "ok";
  const dbOk = health.status === "ok" && health.db;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <LinearGradient colors={["#5B3FB0", "#B58BE0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.arabic}>خِشّه</Text>
          <Text style={styles.brand}>Khisha</Text>
          <Text style={styles.tagline}>خِشّه الحين، تلقاه بعدين</Text>
        </LinearGradient>

        <View style={styles.panel}>
          <Text style={styles.heading}>Connection check</Text>
          <Row label="Edge Function" state={health.status === "loading" ? "loading" : fnOk ? "ok" : "fail"} />
          <Row label="Database" state={health.status === "loading" ? "loading" : dbOk ? "ok" : "fail"} />

          {health.status === "unconfigured" && (
            <Text style={styles.note}>
              Not configured yet. Copy apps/mobile/.env.example to apps/mobile/.env and add your Supabase URL and anon key, then restart Expo.
            </Text>
          )}
          {health.status === "error" && <Text style={styles.noteError}>{health.message}</Text>}
          {health.status === "ok" && !health.db && <Text style={styles.noteError}>The function answered but could not read the database.</Text>}
          {health.status === "ok" && health.db && <Text style={styles.note}>All good. Server time {new Date(health.time).toLocaleTimeString()}.</Text>}

          <Pressable onPress={run} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Text style={styles.buttonText}>Check again</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, state }: { label: string; state: "loading" | "ok" | "fail" }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {state === "loading" ? (
        <ActivityIndicator />
      ) : (
        <Text style={[styles.badge, state === "ok" ? styles.badgeOk : styles.badgeFail]}>{state === "ok" ? "✓ Working" : "✕ Not working"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEEEF0" },
  page: { flex: 1, padding: 16, gap: 16 },
  hero: { borderRadius: 28, padding: 24, gap: 4 },
  arabic: { color: "#fff", fontSize: 40, fontWeight: "600" },
  brand: { color: "#fff", fontSize: 28, fontWeight: "600" },
  tagline: { color: "#fff", opacity: 0.92, fontSize: 16, marginTop: 4 },
  panel: { backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: "600", color: "#111114" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 32 },
  rowLabel: { fontSize: 16, color: "#111114" },
  badge: { fontSize: 14, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: "hidden" },
  badgeOk: { color: "#157A52", backgroundColor: "rgba(21,122,82,0.13)" },
  badgeFail: { color: "#C23636", backgroundColor: "rgba(194,54,54,0.12)" },
  note: { fontSize: 13, color: "#6B6B76" },
  noteError: { fontSize: 13, color: "#C23636" },
  button: { backgroundColor: "#111114", borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
