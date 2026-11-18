import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n";
import { fromISODate, toISODate } from "../lib/dates";
import { AppText } from "./AppText";
import { colors, radius } from "./theme";

type Props = {
  /** "YYYY-MM-DD", or "" when no date is set */
  value: string;
  onChange: (iso: string) => void;
  label: string;
  /** when true a clear button removes the date */
  clearable?: boolean;
};

/** A date shown as "18 Nov 2026". Tapping it opens a calendar to pick from, so nobody types a date. */
export function DateField({ value, onChange, label, clearable = false }: Props) {
  const { t, lang, formatDate } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => (value ? fromISODate(value) : new Date()));

  const openPicker = () => {
    setDraft(value ? fromISODate(value) : new Date());
    setOpen(true);
  };

  const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === "set" && date) onChange(toISODate(date));
  };

  return (
    <>
      <View style={styles.field}>
        <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : t("memory.datePlaceholder")}`} style={styles.main}>
          <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          <AppText variant="body" color={value ? colors.ink : colors.textSecondary} style={{ flex: 1 }}>
            {value ? formatDate(value) : t("memory.datePlaceholder")}
          </AppText>
        </Pressable>
        {clearable && value !== "" && (
          <Pressable onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel={t("memory.dateClear")} hitSlop={10}>
            <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {open && Platform.OS === "android" && <DateTimePicker value={draft} mode="date" onChange={onAndroidChange} />}

      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t("memory.cancel")} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">{label}</AppText>
              <Pressable
                onPress={() => {
                  onChange(toISODate(draft));
                  setOpen(false);
                }}
                accessibilityRole="button"
                style={styles.done}
              >
                <AppText variant="label" color={colors.textOnGradient}>
                  {t("common.done")}
                </AppText>
              </Pressable>
            </View>
            <DateTimePicker value={draft} mode="date" display="inline" locale={locale} accentColor={colors.violetStart} themeVariant="light" onChange={(_e, d) => d && setDraft(d)} style={styles.picker} />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, minHeight: 52 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,20,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, gap: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 },
  done: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 },
  picker: { alignSelf: "stretch" },
});
