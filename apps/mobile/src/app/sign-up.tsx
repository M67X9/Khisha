import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useI18n, type MessageKey } from "../i18n";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { AppText } from "../ui/AppText";
import { AuthLayout } from "../ui/AuthLayout";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { colors, radius } from "../ui/theme";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const { t, formatNumber } = useI18n();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const min = formatNumber(MIN_PASSWORD_LENGTH);

  const submit = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) return setErrorKey("auth.err.notConfigured");
    if (!EMAIL_PATTERN.test(email.trim())) return setErrorKey("auth.err.email");
    if (password.length < MIN_PASSWORD_LENGTH) return setErrorKey("auth.err.passwordShort");
    setErrorKey(null);
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    if (!result.ok) return setErrorKey(result.messageKey);
    if (result.needsEmailConfirmation) setCheckEmail(true);
    // Otherwise a session exists and the router moves to the signed-in screens by itself.
  };

  if (checkEmail) {
    return (
      <AuthLayout title={t("auth.checkEmailTitle")}>
        <View style={styles.info}>
          <AppText variant="body">{t("auth.checkEmailBody", { email: email.trim() })}</AppText>
        </View>
        <Button label={t("auth.goSignIn")} onPress={() => router.replace("/sign-in")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.createTitle")}>
      <TextField icon="mail-outline" accessibilityLabel={t("auth.email")} placeholder={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <TextField icon="lock-closed-outline" accessibilityLabel={t("auth.password")} placeholder={t("auth.passwordNew", { min })} value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
      {errorKey && (
        <AppText variant="label" color={colors.statusError} accessibilityLiveRegion="polite">
          {t(errorKey, { min })}
        </AppText>
      )}
      <Button label={t("auth.createAccount")} onPress={submit} loading={busy} />
      <Button label={t("auth.haveAccount")} variant="secondary" onPress={() => router.replace("/sign-in")} disabled={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  info: { backgroundColor: colors.tintViolet, borderRadius: radius.md, padding: 16 },
});
