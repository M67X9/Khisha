import type { StructuredFields } from "@khisha/shared";

import type { MessageKey } from "../i18n";

/** "KWD 18.450" / "18.450 د.ك", or null when the memory has no amount. */
export function formatAmount(t: (key: MessageKey, params?: Record<string, string | number>) => string, fields: StructuredFields | null | undefined): string | null {
  const amount = fields?.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return t("money.kwd", { amount: amount.toFixed(3) });
}
