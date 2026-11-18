import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "../lib/auth";
import { colors } from "../ui/theme";

function Navigator() {
  const { session, loading } = useAuth();
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
      {/* Cover the screen until the saved session has been read, so a signed-in user never sees the sign-in screen flash by. */}
      {loading && (
        <View style={styles.loading} accessibilityLabel="Loading">
          <ActivityIndicator />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bgApp, alignItems: "center", justifyContent: "center" },
});
