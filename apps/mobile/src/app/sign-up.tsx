import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { AuthLayout } from "../ui/AuthLayout";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { colors, radius } from "../ui/theme";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) return setError("The app is not connected to Supabase yet. Add apps/mobile/.env and restart Expo.");
    if (!EMAIL_PATTERN.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
    setError(null);
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.needsEmailConfirmation) setCheckEmail(true);
    // Otherwise a session exists and the router moves to the signed-in screens by itself.
  };

  if (checkEmail) {
    return (
      <AuthLayout title="Check your email">
        <View style={styles.info}>
          <Text style={styles.infoText}>We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.</Text>
        </View>
        <Button label="Go to sign in" onPress={() => router.replace("/sign-in")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      <TextField icon="mail-outline" accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <TextField icon="lock-closed-outline" accessibilityLabel="Password" placeholder={`Password (${MIN_PASSWORD_LENGTH}+ characters)`} value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Button label="Create account" onPress={submit} loading={busy} />
      <Button label="I already have an account" variant="secondary" onPress={() => router.replace("/sign-in")} disabled={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.statusError, fontSize: 14 },
  info: { backgroundColor: colors.tintViolet, borderRadius: radius.md, padding: 16 },
  infoText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
});
