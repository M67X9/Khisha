import type { Gender } from "@khisha/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../i18n";
import { useAuth } from "../../lib/auth";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { GenderPicker } from "../../ui/GenderPicker";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { fontFamily } from "../../ui/typography";

const MAX_NAME_LENGTH = 60;

/** Edit the name and gender. Choosing a gender previews the colours straight away. */
export default function ProfileScreen() {
  const { t, lang, isRTL, isArabic } = useI18n();
  const { profile, updateProfile } = useAuth();
  const { setPreviewGender } = useTheme();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "unspecified");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreviewGender(gender);
    return () => setPreviewGender(null);
  }, [gender, setPreviewGender]);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return setErrorKey("profile.err.name");
    setErrorKey(null);
    setBusy(true);
    const ok = await updateProfile({ display_name: trimmed, gender });
    setBusy(false);
    if (!ok) return setErrorKey("profile.err.save");
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title={t("profile.title")} />
          <View style={styles.group}>
            <AppText variant="label" color={colors.textSecondary}>
              {t("profile.name")}
            </AppText>
            <TextInput
              accessibilityLabel={t("profile.name")}
              style={[styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: isRTL ? "right" : "left", writingDirection: isArabic ? "rtl" : "ltr" }]}
              value={name}
              onChangeText={setName}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              textContentType="givenName"
            />
          </View>
          <View style={styles.group}>
            <AppText variant="label" color={colors.textSecondary}>
              {t("profile.gender")}
            </AppText>
            <GenderPicker value={gender} onChange={setGender} />
            <AppText variant="caption" color={colors.textSecondary}>
              {t("auth.genderNote")}
            </AppText>
          </View>
          {errorKey && (
            <AppText variant="label" color={colors.statusError} accessibilityLiveRegion="polite">
              {t(errorKey)}
            </AppText>
          )}
          <Button label={t("profile.save")} onPress={save} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  group: { gap: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52, fontSize: 16, color: colors.ink },
});
