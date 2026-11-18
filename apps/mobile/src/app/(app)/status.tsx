import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../i18n";
import { checkHealth, type HealthState } from "../../lib/health";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, gradients, radius } from "../../ui/theme";

/** Connection check: proves the app can reach the Supabase Edge Function and the database (kept from milestone M0). */
export default function StatusScreen() {
  const { t } = useI18n();
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

  const errorKey: MessageKey | null =
    health.status === "error"
      ? health.code === "http"
        ? "status.http"
        : health.code === "unexpected"
          ? "status.unexpected"
          : health.code === "timeout"
            ? "status.timeout"
            : "status.network"
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <ScreenHeader title={t("status.title")} />
        <LinearGradient colors={[...gradients.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <AppText variant="title" color={colors.textOnGradient}>
            {t("status.title")}
          </AppText>
        </LinearGradient>

        <View style={styles.panel}>
          <Row label={t("status.function")} state={health.status === "loading" ? "loading" : fnOk ? "ok" : "fail"} />
          <Row label={t("status.database")} state={health.status === "loading" ? "loading" : dbOk ? "ok" : "fail"} />

          {health.status === "unconfigured" && (
            <AppText variant="caption" color={colors.textSecondary}>
              {t("status.unconfigured")}
            </AppText>
          )}
          {errorKey && (
            <AppText variant="caption" color={colors.statusError}>
              {t(errorKey, { code: health.status === "error" ? (health.httpStatus ?? "") : "" })}
            </AppText>
          )}
          {health.status === "ok" && !health.db && (
            <AppText variant="caption" color={colors.statusError}>
              {t("status.noDb")}
            </AppText>
          )}
          {health.status === "ok" && health.db && (
            <AppText variant="caption" color={colors.textSecondary}>
              {t("status.ok", { time: new Date(health.time).toLocaleTimeString("en-US") })}
            </AppText>
          )}
        </View>

        <Button label={t("status.again")} onPress={run} />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, state }: { label: string; state: "loading" | "ok" | "fail" }) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <AppText variant="body">{label}</AppText>
      {state === "loading" ? (
        <ActivityIndicator />
      ) : (
        <View style={[styles.badge, state === "ok" ? styles.badgeOk : styles.badgeFail]}>
          <AppText variant="label" color={state === "ok" ? colors.statusVerified : colors.statusError}>
            {state === "ok" ? t("status.working") : t("status.notWorking")}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { flex: 1, padding: 16, gap: 16 },
  hero: { borderRadius: radius.lg, padding: 24 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 32 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeOk: { backgroundColor: colors.tintVerified },
  badgeFail: { backgroundColor: "rgba(194,54,54,0.12)" },
});
