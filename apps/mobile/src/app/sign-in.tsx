import { router } from "expo-router";
import { useState } from "react";

import { useI18n, type MessageKey } from "../i18n";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { AppText } from "../ui/AppText";
import { AuthLayout } from "../ui/AuthLayout";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { colors } from "../ui/theme";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) return setErrorKey("auth.err.notConfigured");
    if (!EMAIL_PATTERN.test(email.trim())) return setErrorKey("auth.err.email");
    if (password.length === 0) return setErrorKey("auth.err.passwordEmpty");
    setErrorKey(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setErrorKey(result.messageKey);
    // On success the session changes and the router moves to the signed-in screens by itself.
  };

  return (
    <AuthLayout title={t("auth.welcomeBack")}>
      <TextField icon="mail-outline" accessibilityLabel={t("auth.email")} placeholder={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <TextField icon="lock-closed-outline" accessibilityLabel={t("auth.password")} placeholder={t("auth.password")} value={password} onChangeText={setPassword} secure autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      {errorKey && (
        <AppText variant="label" color={colors.statusError} accessibilityLiveRegion="polite">
          {t(errorKey)}
        </AppText>
      )}
      <Button label={t("auth.signIn")} onPress={submit} loading={busy} />
      <Button label={t("auth.createAccount")} variant="secondary" onPress={() => router.push("/sign-up")} disabled={busy} />
      <AppText variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>
        {t("auth.providersNote")}
      </AppText>
    </AuthLayout>
  );
}
