import type { Lang } from "../i18n";

type Weight = "400" | "500" | "600";

/** Type scale from the Figma file (Inter for English, Noto Sans Arabic for Arabic). Arabic gets 4px more line height. */
export const scale = {
  number: { size: 40, lineHeight: 48, weight: "600" },
  title: { size: 28, lineHeight: 34, weight: "600" },
  heading: { size: 20, lineHeight: 26, weight: "600" },
  body: { size: 16, lineHeight: 24, weight: "400" },
  bodyStrong: { size: 16, lineHeight: 24, weight: "500" },
  label: { size: 14, lineHeight: 20, weight: "500" },
  caption: { size: 13, lineHeight: 18, weight: "400" },
} as const satisfies Record<string, { size: number; lineHeight: number; weight: Weight }>;

export type Variant = keyof typeof scale;

const NAMES: Record<Weight, string> = { "400": "Regular", "500": "Medium", "600": "SemiBold" };

export function fontFamily(lang: Lang, weight: Weight): string {
  return `${lang === "ar" ? "NotoSansArabic" : "Inter"}_${weight}${NAMES[weight]}`;
}
