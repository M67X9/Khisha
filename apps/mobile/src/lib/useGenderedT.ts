import { useI18n, type MessageKey } from "../i18n";
import { useTheme } from "../ui/ThemeProvider";

/** Keys that have a feminine variant named "<key>.f" (used for Arabic sentences that address the person). */
export type GenderedKey = { [K in MessageKey]: K extends `${infer Base}.f` ? Base : never }[MessageKey];

/** Like t(), but picks the feminine wording when the person chose "female". Everyone else gets the default wording. */
export function useGenderedT() {
  const { t } = useI18n();
  const { gender } = useTheme();
  return (key: GenderedKey & MessageKey, params?: Record<string, string | number>) => t(gender === "female" ? (`${key}.f` as MessageKey) : key, params);
}
