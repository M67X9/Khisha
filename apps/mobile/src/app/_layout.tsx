import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { I18nProvider, useI18n } from "../i18n";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useAppFonts } from "../ui/fonts";
import { ThemeProvider } from "../ui/ThemeProvider";
import { colors } from "../ui/theme";

/** Keeps the saved profile language in step with the language chosen on this device (this device wins). */
function useLanguageSync() {
  const { lang } = useI18n();
  const { profile } = useAuth();
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || profile.preferred_language === lang) return;
    const marker = `${profile.id}:${lang}`;
    if (synced.current === marker) return;
    synced.current = marker;
    supabase.from("profiles").update({ preferred_language: lang }).eq("id", profile.id).then(({ error }) => {
      if (error) synced.current = null; // try again next time
    });
  }, [profile, lang]);
}

function Navigator() {
  const { session, loading } = useAuth();
  const fontsReady = useAppFonts();
  useLanguageSync();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
      {/* Cover the screen until the saved session and the fonts are ready, so nothing flashes by. */}
      {(loading || !fontsReady) && (
        <View style={styles.loading} accessibilityLabel="Loading">
          <ActivityIndicator />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider>
          <StatusBar style="dark" />
          <Navigator />
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bgApp, alignItems: "center", justifyContent: "center" },
});
