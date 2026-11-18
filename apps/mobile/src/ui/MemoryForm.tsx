import { MEMORY_CATEGORIES, type MemoryInput } from "@khisha/shared";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { useI18n, type MessageKey } from "../i18n";
import { todayISO } from "../lib/dates";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { metaFor } from "./categories";
import { DateField } from "./DateField";
import { colors, radius } from "./theme";
import { useTheme } from "./ThemeProvider";
import { fontFamily } from "./typography";

export type MemoryFormValues = { title: string; category: string; date: string; amount: string; notes: string };

/** A new memory starts with today's date. */
export function emptyMemoryForm(): MemoryFormValues {
  return { title: "", category: "receipt", date: todayISO(), amount: "", notes: "" };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Checks the form and turns it into what the database stores. Returns an error message key when something is wrong. */
export function parseMemoryForm(v: MemoryFormValues): { ok: true; input: MemoryInput } | { ok: false; error: MessageKey } {
  const title = v.title.trim();
  if (title.length === 0 || title.length > 200) return { ok: false, error: "memory.err.title" };

  const date = v.date.trim();
  if (date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!DATE_PATTERN.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return { ok: false, error: "memory.err.date" };
  }

  const fields: MemoryInput["structured_fields"] = {};
  const amountText = v.amount.trim().replace(",", ".");
  if (amountText) {
    const amount = Number(amountText);
    if (!/^\d+(\.\d{1,3})?$/.test(amountText) || !Number.isFinite(amount) || amount > 1_000_000_000) return { ok: false, error: "memory.err.amount" };
    fields.amount = amount;
    fields.currency = "KWD";
  }

  const notes = v.notes.trim();
  return { ok: true, input: { title, category: v.category, notes: notes || null, document_date: date || null, structured_fields: fields } };
}

type Props = {
  initial: MemoryFormValues;
  submitLabel: string;
  onSubmit: (input: MemoryInput) => Promise<void>;
  /** shown above the fields */
  note?: string;
};

export function MemoryForm({ initial, submitLabel, onSubmit, note }: Props) {
  const { t, lang, isRTL } = useI18n();
  const theme = useTheme();
  const [values, setValues] = useState<MemoryFormValues>(initial);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<MemoryFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const inputStyle = [styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: "left" as const, writingDirection: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr" }];

  const submit = async () => {
    if (busy) return;
    const parsed = parseMemoryForm(values);
    if (!parsed.ok) return setErrorKey(parsed.error);
    setErrorKey(null);
    setBusy(true);
    try {
      await onSubmit(parsed.input);
    } catch {
      setErrorKey("memory.err.save");
      setBusy(false);
    }
    // On success the screen navigates away, so the busy state is left on.
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {note && (
          <View style={[styles.note, { backgroundColor: theme.tint }]}>
            <AppText variant="caption">{note}</AppText>
          </View>
        )}

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("memory.fieldTitle")}
          </AppText>
          <TextInput accessibilityLabel={t("memory.fieldTitle")} style={inputStyle} value={values.title} onChangeText={(title) => set({ title })} placeholder={t("memory.titlePlaceholder")} placeholderTextColor={colors.textSecondary} maxLength={200} returnKeyType="next" />
        </View>

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("memory.fieldCategory")}
          </AppText>
          <View style={styles.chips}>
            {MEMORY_CATEGORIES.map((key) => {
              const active = values.category === key;
              return (
                <Pressable key={key} onPress={() => set({ category: key })} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
                  <AppText variant="label" color={active ? colors.textOnGradient : colors.ink}>
                    {t(metaFor(key).label)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("memory.fieldDate")}
          </AppText>
          <DateField label={t("memory.fieldDate")} value={values.date} onChange={(date) => set({ date })} clearable />
        </View>

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("memory.fieldAmount")}
          </AppText>
          <TextInput accessibilityLabel={t("memory.fieldAmount")} style={inputStyle} value={values.amount} onChangeText={(amount) => set({ amount })} placeholder={t("memory.amountPlaceholder")} placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" maxLength={14} />
        </View>

        <View style={styles.group}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("memory.fieldNotes")}
          </AppText>
          <TextInput accessibilityLabel={t("memory.fieldNotes")} style={[inputStyle, styles.multiline]} value={values.notes} onChangeText={(notes) => set({ notes })} placeholder={t("memory.notesPlaceholder")} placeholderTextColor={colors.textSecondary} multiline textAlignVertical="top" maxLength={5000} />
        </View>

        {errorKey && (
          <AppText variant="label" color={colors.statusError} accessibilityLiveRegion="polite">
            {t(errorKey)}
          </AppText>
        )}
        <Button label={submitLabel} onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  note: { backgroundColor: colors.tintViolet, borderRadius: radius.md, padding: 14 },
  group: { gap: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 110, paddingTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
});
