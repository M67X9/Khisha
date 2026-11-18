import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { AuthLayout } from "../ui/AuthLayout";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { colors } from "../ui/theme";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) return setError("The app is not connected to Supabase yet. Add apps/mobile/.env and restart Expo.");
    if (!EMAIL_PATTERN.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length === 0) return setError("Enter your password.");
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // On success the session changes and the router moves to the signed-in screens by itself.
  };

  return (
    <AuthLayout title="Welcome back">
      <TextField icon="mail-outline" accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <TextField icon="lock-closed-outline" accessibilityLabel="Password" placeholder="Password" value={password} onChangeText={setPassword} secure autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Button label="Sign in" onPress={submit} loading={busy} />
      <Button label="Create account" variant="secondary" onPress={() => router.push("/sign-up")} disabled={busy} />
      <Text style={styles.note}>Apple and Google sign-in arrive in the public release</Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.statusError, fontSize: 14 },
  note: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
});
