import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import type { MemoryCategory } from "@khisha/shared";

import type { MessageKey } from "../i18n";
import type { gradients } from "./theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type CategoryMeta = { key: MemoryCategory; tone: keyof typeof gradients; icon: IconName; label: MessageKey };

export const categoryMeta: Record<MemoryCategory, CategoryMeta> = {
  receipt: { key: "receipt", tone: "coral", icon: "receipt-outline", label: "category.receipt" },
  movie: { key: "movie", tone: "violet", icon: "film-outline", label: "category.movie" },
  product: { key: "product", tone: "blue", icon: "bag-handle-outline", label: "category.product" },
  place: { key: "place", tone: "amber", icon: "location-outline", label: "category.place" },
  car: { key: "car", tone: "teal", icon: "car-outline", label: "category.car" },
  document: { key: "document", tone: "slate", icon: "document-text-outline", label: "category.document" },
  other: { key: "other", tone: "slate", icon: "ellipsis-horizontal-circle-outline", label: "category.other" },
};

/** Unknown categories (for example AI-made ones later) fall back to "other". */
export function metaFor(category: string): CategoryMeta {
  return (categoryMeta as Record<string, CategoryMeta | undefined>)[category] ?? categoryMeta.other;
}
