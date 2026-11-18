import type React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { MemorySummary } from "@khisha/shared";
import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../i18n";
import { askQuestion, AskFailure, type AnswerKind } from "../../lib/ask";
import { AppText } from "../../ui/AppText";
import { MemoryRow } from "../../ui/MemoryRow";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { colors, radius, shadowPanel } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { fontFamily } from "../../ui/typography";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; kind: AnswerKind; sources: MemorySummary[] }
  | { id: string; role: "error"; text: MessageKey; question: string };

const KIND_KEYS: Record<AnswerKind, MessageKey> = {
  personal: "ask.kind.personal",
  general: "ask.kind.general",
  mixed: "ask.kind.mixed",
  none: "ask.kind.none",
};

let counter = 0;
const nextId = () => `t${++counter}`;

/** Ask AI (Figma: Ask AI): answers come from the person's own memories, with tappable sources. */
export default function AskScreen() {
  const { t, lang, isRTL, isArabic } = useI18n();
  const theme = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const conversation = useRef<string | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText("");
    setBusy(true);
    setTurns((cur) => [...cur.filter((x) => x.role !== "error"), { id: nextId(), role: "user", text: q }]);
    try {
      const answer = await askQuestion(q, conversation.current);
      conversation.current = answer.conversationId;
      setTurns((cur) => [...cur, { id: nextId(), role: "assistant", text: answer.content, kind: answer.kind, sources: answer.sources }]);
    } catch (e) {
      setTurns((cur) => [...cur, { id: nextId(), role: "error", text: e instanceof AskFailure ? e.key : "ask.err.generic", question: q }]);
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    conversation.current = null;
    setTurns([]);
  };

  const inputStyle = [styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: (isRTL ? "right" : "left") as "left" | "right", writingDirection: (isArabic ? "rtl" : "ltr") as "rtl" | "ltr" }];
  const suggestions: MessageKey[] = ["ask.suggest1", "ask.suggest2", "ask.suggest3"];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <ScreenHeader title={t("bar.ask")} />
        </View>

        <ScrollView ref={scroller} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })} showsVerticalScrollIndicator={false}>
          {turns.length === 0 && (
            <View style={styles.intro}>
              <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                <Ionicons name="sparkles" size={26} color={theme.accent} />
              </View>
              <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
                {t("ask.intro")}
              </AppText>
              <View style={{ gap: 8, alignSelf: "stretch" }}>
                {suggestions.map((key) => (
                  <Pressable key={key} onPress={() => send(t(key))} accessibilityRole="button" style={styles.suggest}>
                    <AppText variant="label">{t(key)}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {turns.map((turn) => {
            if (turn.role === "user") {
              return (
                <View key={turn.id} style={[styles.bubble, styles.userBubble, { backgroundColor: colors.ink }]}>
                  <AppText variant="body" color={colors.textOnGradient}>
                    {turn.text}
                  </AppText>
                </View>
              );
            }
            if (turn.role === "error") {
              return (
                <View key={turn.id} style={styles.errorBox} accessibilityLiveRegion="polite">
                  <AppText variant="label" color={colors.statusError}>
                    {t(turn.text)}
                  </AppText>
                  <Pressable onPress={() => send(turn.question)} accessibilityRole="button">
                    <AppText variant="label" color={theme.accent}>
                      {t("memory.retry")}
                    </AppText>
                  </Pressable>
                </View>
              );
            }
            return (
              <View key={turn.id} style={{ gap: 8 }}>
                <View style={[styles.bubble, styles.botBubble]}>
                  <AppText variant="body">{turn.text}</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {t(KIND_KEYS[turn.kind])}
                  </AppText>
                </View>
                {turn.sources.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <AppText variant="label" color={colors.textSecondary}>
                      {t("ask.sources")}
                    </AppText>
                    {turn.sources.map((m) => (
                      <MemoryRow key={m.id} memory={m} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {busy && (
            <View style={[styles.bubble, styles.botBubble, styles.thinking]}>
              <ActivityIndicator color={theme.accent} />
              <AppText variant="caption" color={colors.textSecondary}>
                {t("ask.thinking")}
              </AppText>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          {turns.length > 0 && !busy && (
            <Pressable onPress={newChat} accessibilityRole="button" accessibilityLabel={t("ask.new")} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={28} color={colors.textSecondary} />
            </Pressable>
          )}
          <TextInput
            accessibilityLabel={t("ask.placeholder")}
            style={inputStyle}
            value={text}
            onChangeText={setText}
            placeholder={t("ask.placeholder")}
            placeholderTextColor={colors.textSecondary}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send(text)}
            editable={!busy}
          />
          <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel={t("ask.send")} style={[styles.send, { backgroundColor: theme.accent, opacity: busy || !text.trim() ? 0.4 : 1 }]}>
            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color={colors.textOnGradient} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  page: { padding: 16, gap: 14, paddingBottom: 24, flexGrow: 1 },
  intro: { alignItems: "center", gap: 14, paddingTop: 24 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  suggest: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, ...shadowPanel },
  bubble: { borderRadius: radius.md, padding: 14, maxWidth: "90%", gap: 6 },
  userBubble: { alignSelf: "flex-end" },
  botBubble: { alignSelf: "flex-start", backgroundColor: colors.surface, ...shadowPanel },
  thinking: { flexDirection: "row", alignItems: "center", gap: 10 },
  errorBox: { backgroundColor: "rgba(194,54,54,0.10)", borderRadius: radius.md, padding: 14, gap: 6 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, minHeight: 48, fontSize: 16, color: colors.ink, ...shadowPanel },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
