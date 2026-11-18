import { Ionicons } from "@expo/vector-icons";
import { MEMORY_CATEGORIES, type MemoryEvidence } from "@khisha/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n, type MessageKey } from "../../../i18n";
import { getEvidence, getMemory } from "../../../lib/memories";
import { discardDraft, finalizeMemory, getPreview, ReviewFailure, type Preview } from "../../../lib/review";
import { useLoad } from "../../../lib/useLoad";
import { AppText } from "../../../ui/AppText";
import { Button } from "../../../ui/Button";
import { metaFor } from "../../../ui/categories";
import { DateField } from "../../../ui/DateField";
import { ScreenHeader } from "../../../ui/ScreenHeader";
import { colors, radius, shadowPanel } from "../../../ui/theme";
import { useTheme } from "../../../ui/ThemeProvider";
import { fontFamily } from "../../../ui/typography";

const KEEP_BY_DEFAULT = ["receipt", "document", "car"];
const KNOWN_KEYS = ["total", "date", "event_date", "merchant"];

/**
 * Review before saving (milestone M6). The AI's draft is shown next to the original file. Every important figure
 * or date it found must be confirmed by the person before the memory is saved.
 */
export default function ReviewScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useLoad(async () => {
    const memory = await getMemory(String(id));
    if (!memory) return null;
    const evidence = await getEvidence(String(id)).catch((): MemoryEvidence[] => []);
    return { memory, evidence };
  }, [id]);

  // A memory that is already saved belongs on its own screen.
  useEffect(() => {
    if (state.status === "ok" && state.data && state.data.memory.status !== "draft") router.replace(`/memory/${state.data.memory.id}`);
  }, [state]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title={t("review.title")} />
          {state.status === "loading" && <ActivityIndicator style={{ marginTop: 40 }} />}
          {state.status === "error" && (
            <View style={{ gap: 12 }}>
              <AppText variant="body" color={colors.statusError}>
                {t("memory.loadError")}
              </AppText>
              <Button label={t("memory.retry")} onPress={reload} />
            </View>
          )}
          {state.status === "ok" && state.data === null && <AppText variant="body">{t("memory.notFound")}</AppText>}
          {state.status === "ok" && state.data && state.data.memory.status === "draft" && <ReviewForm memory={state.data.memory} evidence={state.data.evidence} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Memory = NonNullable<Awaited<ReturnType<typeof getMemory>>>;

function ReviewForm({ memory, evidence }: { memory: Memory; evidence: MemoryEvidence[] }) {
  const { t, lang, isRTL, isArabic } = useI18n();
  const theme = useTheme();
  const byKey = useMemo(() => new Map(evidence.map((e) => [e.field_key, e])), [evidence]);
  const fields = memory.structured_fields ?? {};

  const [title, setTitle] = useState(memory.title);
  const [category, setCategory] = useState(memory.category);
  const [date, setDate] = useState(memory.document_date ?? "");
  const [eventDate, setEventDate] = useState(memory.event_date ?? "");
  const [amount, setAmount] = useState(typeof fields.amount === "number" ? String(fields.amount) : "");
  const [merchant, setMerchant] = useState(typeof fields.merchant === "string" ? fields.merchant : "");
  const [notes, setNotes] = useState(memory.notes ?? "");
  const [keep, setKeep] = useState(KEEP_BY_DEFAULT.includes(memory.category));
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    let alive = true;
    getPreview(memory.id).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [memory.id]);

  const confirm = (key: string) => setConfirmed((s) => new Set(s).add(key));
  const unconfirm = (key: string) =>
    setConfirmed((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });

  // What the form currently holds for each important field. "" means cleared: nothing to confirm.
  const values: Record<string, string> = { total: amount.trim(), date, event_date: eventDate };
  const extras = evidence.filter((e) => e.is_critical && !KNOWN_KEYS.includes(e.field_key));
  const required = [
    ...["total", "date", "event_date"].filter((k) => byKey.get(k)?.is_critical && values[k] !== ""),
    ...extras.map((e) => e.field_key),
  ];
  const allConfirmed = required.every((k) => confirmed.has(k));
  const lowCategory = memory.category_confidence !== null && memory.category_confidence < 0.7;
  const expired = preview === null; // no usable file: it expired, or could not be loaded
  const canKeep = !expired;

  const inputStyle = [styles.input, { fontFamily: fontFamily(lang, "400"), textAlign: (isRTL ? "right" : "left") as "left" | "right", writingDirection: (isArabic ? "rtl" : "ltr") as "rtl" | "ltr" }];

  const save = async () => {
    if (busy) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) return setErrorKey("memory.err.title");
    const amountText = amount.trim().replace(",", ".");
    let amountValue: number | null = null;
    if (amountText) {
      amountValue = Number(amountText);
      if (!/^\d+(\.\d{1,3})?$/.test(amountText) || !Number.isFinite(amountValue) || amountValue > 1_000_000_000) return setErrorKey("memory.err.amount");
    }
    setErrorKey(null);
    setBusy(true);
    try {
      const currency = typeof fields.currency === "string" && fields.currency ? fields.currency : amountValue !== null ? "KWD" : null;
      await finalizeMemory({
        memory_id: memory.id,
        title: cleanTitle,
        category,
        notes,
        document_date: date || null,
        event_date: eventDate || null,
        amount: amountValue,
        currency: amountValue !== null ? currency : null,
        merchant,
        confirmed: [...confirmed],
        keep_original: keep && canKeep,
      });
      router.replace(`/memory/${memory.id}`);
    } catch (e) {
      setErrorKey(e instanceof ReviewFailure ? e.key : "review.err.save");
      setBusy(false);
    }
  };

  const askDiscard = () => {
    Alert.alert(t("review.discardTitle"), t("review.discardBody"), [
      { text: t("memory.cancel"), style: "cancel" },
      {
        text: t("review.discard"),
        style: "destructive",
        onPress: async () => {
          try {
            await discardDraft(memory.id);
            router.replace("/");
          } catch {
            Alert.alert(t("review.err.discard"));
          }
        },
      },
    ]);
  };

  const confidenceOf = (key: string) => byKey.get(key)?.confidence ?? null;

  return (
    <>
      <AppText variant="body" color={colors.textSecondary}>
        {t("review.intro")}
      </AppText>

      <View style={styles.preview}>
        {preview === undefined && <ActivityIndicator />}
        {preview === null && (
          <View style={styles.previewEmpty}>
            <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
            <AppText variant="caption" color={colors.textSecondary}>
              {t("review.previewExpired")}
            </AppText>
          </View>
        )}
        {preview && preview.mimeType.startsWith("image/") && <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" accessibilityIgnoresInvertColors />}
        {preview && !preview.mimeType.startsWith("image/") && (
          <View style={[styles.previewEmpty, { backgroundColor: theme.tint, borderRadius: radius.md, padding: 24 }]}>
            <Ionicons name="document-text-outline" size={36} color={theme.accent} />
            <AppText variant="caption">PDF</AppText>
          </View>
        )}
      </View>
      {preview && (
        <AppText variant="caption" color={colors.textSecondary}>
          {t("review.previewExpires")}
        </AppText>
      )}

      <Group label={t("memory.fieldTitle")}>
        <TextInput accessibilityLabel={t("memory.fieldTitle")} style={inputStyle} value={title} onChangeText={setTitle} maxLength={200} />
      </Group>

      <Group label={t("memory.fieldCategory")} flag={lowCategory ? t("review.checkCategory") : undefined}>
        <View style={styles.chips}>
          {MEMORY_CATEGORIES.map((key) => {
            const active = category === key;
            return (
              <Pressable key={key} onPress={() => setCategory(key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
                <AppText variant="label" color={active ? colors.textOnGradient : colors.ink}>
                  {t(metaFor(key).label)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Group>

      <Critical
        label={t("review.fieldTotal")}
        needed={required.includes("total")}
        confirmed={confirmed.has("total")}
        onConfirm={() => confirm("total")}
        lowConfidence={(confidenceOf("total") ?? 1) < 0.7}
      >
        <TextInput
          accessibilityLabel={t("review.fieldTotal")}
          style={inputStyle}
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            unconfirm("total");
          }}
          placeholder={t("memory.amountPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          maxLength={14}
        />
      </Critical>

      <Critical
        label={t("memory.fieldDate")}
        needed={required.includes("date")}
        confirmed={confirmed.has("date")}
        onConfirm={() => confirm("date")}
        lowConfidence={(confidenceOf("date") ?? 1) < 0.7}
      >
        <DateField
          label={t("memory.fieldDate")}
          value={date}
          onChange={(v) => {
            setDate(v);
            unconfirm("date");
          }}
          clearable
        />
      </Critical>

      {(byKey.has("event_date") || eventDate !== "") && (
        <Critical
          label={t("review.fieldEventDate")}
          needed={required.includes("event_date")}
          confirmed={confirmed.has("event_date")}
          onConfirm={() => confirm("event_date")}
          lowConfidence={(confidenceOf("event_date") ?? 1) < 0.7}
        >
          <DateField
            label={t("review.fieldEventDate")}
            value={eventDate}
            onChange={(v) => {
              setEventDate(v);
              unconfirm("event_date");
            }}
            clearable
          />
        </Critical>
      )}

      <Group label={t("review.fieldMerchant")}>
        <TextInput accessibilityLabel={t("review.fieldMerchant")} style={inputStyle} value={merchant} onChangeText={setMerchant} maxLength={120} />
      </Group>

      {extras.length > 0 && (
        <View style={styles.panel}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("review.otherDetails")}
          </AppText>
          {extras.map((e) => (
            <View key={e.id} style={{ gap: 8 }}>
              <View style={styles.kv}>
                <AppText variant="label" color={colors.textSecondary}>
                  {e.field_key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                </AppText>
                <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: "right" }}>
                  {e.value ?? ""}
                </AppText>
              </View>
              <ConfirmButton confirmed={confirmed.has(e.field_key)} onPress={() => confirm(e.field_key)} />
            </View>
          ))}
        </View>
      )}

      <Group label={t("memory.fieldNotes")}>
        <TextInput accessibilityLabel={t("memory.fieldNotes")} style={[inputStyle, styles.multiline]} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" maxLength={5000} />
      </Group>

      <View style={styles.panel}>
        <View style={styles.kv}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t("review.keepTitle")}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {canKeep ? t("review.keepBody") : t("review.keepExpired")}
            </AppText>
          </View>
          <Switch value={keep && canKeep} onValueChange={setKeep} disabled={!canKeep} trackColor={{ true: theme.accent }} accessibilityLabel={t("review.keepTitle")} />
        </View>
      </View>

      {errorKey && (
        <AppText variant="label" color={colors.statusError} accessibilityLiveRegion="polite">
          {t(errorKey)}
        </AppText>
      )}
      {!allConfirmed && (
        <AppText variant="caption" color={colors.statusConfirm}>
          {t("review.saveHint")}
        </AppText>
      )}
      <Button label={busy ? t("review.saving") : t("review.save")} onPress={save} loading={busy} disabled={!allConfirmed} />
      <Pressable onPress={askDiscard} accessibilityRole="button" disabled={busy} style={styles.discard}>
        <AppText variant="label" color={colors.statusError}>
          {t("review.discard")}
        </AppText>
      </Pressable>
    </>
  );
}

function Group({ label, flag, children }: { label: string; flag?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <AppText variant="label" color={colors.textSecondary}>
          {label}
        </AppText>
        {flag && (
          <View style={[styles.flag, styles.flagConfirm]}>
            <AppText variant="caption" color={colors.statusConfirm}>
              {flag}
            </AppText>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

/** A field whose value the reader marked important: it needs an explicit Confirm tap, and an edit takes the confirmation back. */
function Critical({ label, needed, confirmed, onConfirm, lowConfidence, children }: { label: string; needed: boolean; confirmed: boolean; onConfirm: () => void; lowConfidence: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <Group label={label} flag={lowConfidence && needed ? t("evidence.lowConfidence") : undefined}>
      {children}
      {needed && <ConfirmButton confirmed={confirmed} onPress={onConfirm} />}
    </Group>
  );
}

function ConfirmButton({ confirmed, onPress }: { confirmed: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} disabled={confirmed} accessibilityRole="button" accessibilityState={{ selected: confirmed }} style={[styles.confirm, confirmed ? styles.confirmDone : styles.confirmTodo]}>
      <Ionicons name={confirmed ? "checkmark-circle" : "ellipse-outline"} size={18} color={confirmed ? colors.statusVerified : colors.statusConfirm} />
      <AppText variant="label" color={confirmed ? colors.statusVerified : colors.statusConfirm}>
        {confirmed ? t("review.confirmed") : t("review.confirm")}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  preview: { backgroundColor: colors.surface, borderRadius: radius.md, minHeight: 120, alignItems: "center", justifyContent: "center", overflow: "hidden", ...shadowPanel },
  previewImage: { width: "100%", height: 260 },
  previewEmpty: { alignItems: "center", gap: 6, padding: 16 },
  group: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  flag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  flagConfirm: { backgroundColor: "rgba(168,95,0,0.12)" },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 90, paddingTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  confirm: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  confirmTodo: { backgroundColor: "rgba(168,95,0,0.12)" },
  confirmDone: { backgroundColor: colors.tintVerified },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 12, ...shadowPanel },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  discard: { alignItems: "center", paddingVertical: 8 },
});
