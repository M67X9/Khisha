import type { Gender } from "@khisha/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useI18n, type MessageKey } from "../i18n";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { AppText } from "../ui/AppText";
import { AuthLayout } from "../ui/AuthLayout";
import { Button } from "../ui/Button";
import { GenderPicker } from "../ui/GenderPicker";
import { TextField } from "../ui/TextField";
import { colors, radius } from "../ui/theme";
import { useTheme } from "../ui/ThemeProvider";
import { fontFamily } from "../ui/typography";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 60;

export default function SignUpScreen() {
  const { t, lang, isRTL, formatNumber } = useI18n();
  const { signUp } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const min = formatNumber(MIN_PASSWORD_LENGTH);

  // Show the chosen look straight away, so the person sees what the choice does.
  const { setPreviewGender } = theme;
  useEffect(() => {
    setPreviewGender(gender);
    return () => setPreviewGender(null);
  }, [gender, setPreviewGender]);

  const submit = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) return setErrorKey("auth.err.notConfigured");
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) return setErrorKey("auth.err.name");
    if (!EMAIL_PATTERN.test(email.trim())) return setErrorKey("auth.err.email");
    if (password.length < MIN_PASSWORD_LENGTH) return setErrorKey("auth.err.passwordShort");
    setErrorKey(null);
    setBusy(true);
    const result = await signUp(email, password, { displayName: trimmedName, gender });
    setBusy(false);
    if (!result.ok) return setErrorKey(result.messageKey);
    if (result.needsEmailConfirmation) setCheckEmail(true);
    // Otherwise a session exists and the router moves to the signed-in screens by itself.
  };

  if (checkEmail) {
    return (
      <AuthLayout title={t("auth.checkEmailTitle")}>
        <View style={[styles.info, { backgroundColor: theme.tint }]}>
          <AppText variant="body">{t("auth.checkEmailBody", { email: email.trim() })}</AppText>
        </View>
        <Button label={t("auth.goSignIn")} onPress={() => router.replace("/sign-in")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.createTitle")}>
      <View style={styles.nameField}>
        <TextInput
          accessibilityLabel={t("auth.name")}
          style={[styles.nameInput, { fontFamily: fontFamily(lang, "400"), textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" }]}
          value={name}
          onChangeText={setName}
          placeholder={t("auth.name")}
          placeholderTextColor={colors.textSecondary}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="name"
          textContentType="givenName"
          returnKeyType="next"
        />
      </View>
      <TextField icon="mail-outline" accessibilityLabel={t("auth.email")} placeholder={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <TextField icon="lock-closed-outline" accessibilityLabel={t("auth.password")} placeholder={t("auth.passwordNew", { min })} value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
      <View style={{ gap: 8 }}>
        <AppText variant="label" color={colors.textSecondary}>
          {t("auth.gender")}
        </AppText>
        <GenderPicker value={gender} onChange={setGender} />
        <AppText variant="caption" color={colors.textSecondary}>
          {t("auth.genderNote")}
        </AppText>
      </View>
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
  info: { borderRadius: radius.md, padding: 16 },
  nameField: { backgroundColor: colors.bgApp, borderRadius: radius.md, paddingHorizontal: 16, minHeight: 56, justifyContent: "center" },
  nameInput: { fontSize: 16, color: colors.ink, paddingVertical: 14 },
});
