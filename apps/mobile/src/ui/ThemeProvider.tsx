import type { Gender } from "@khisha/shared";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "../lib/auth";

/**
 * The same Khisha identity (violet-family gradients, glass, Inter/Alexandria, white panels) in three tones.
 * Everything that is not listed here (ink, panels, category colours, fonts) is identical for everyone.
 */
export type Palette = {
  /** primary gradient for hero cards, avatar, badges and the bar */
  gradient: readonly [string, string];
  /** links, icons and highlights */
  accent: string;
  /** soft background for notes and chips */
  tint: string;
  /** soft glow at the top of Home */
  glow: string;
  /** corner radius of hero cards */
  heroRadius: number;
};

export const palettes: Record<Gender, Palette> = {
  unspecified: { gradient: ["#5B3FB0", "#B58BE0"], accent: "#5B3FB0", tint: "rgba(91,63,176,0.10)", glow: "rgba(181,139,224,0.38)", heroRadius: 28 },
  female: { gradient: ["#9A3FA8", "#F29BC4"], accent: "#9A3FA8", tint: "rgba(154,63,168,0.10)", glow: "rgba(242,155,196,0.42)", heroRadius: 32 },
  male: { gradient: ["#2F46B0", "#6FB3F2"], accent: "#2F46B0", tint: "rgba(47,70,176,0.10)", glow: "rgba(111,179,242,0.38)", heroRadius: 22 },
};

type ThemeState = Palette & {
  gender: Gender;
  /** Shows another tone without saving it (the sign-up and profile screens preview the choice live). Pass null to stop. */
  setPreviewGender: (g: Gender | null) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [preview, setPreview] = useState<Gender | null>(null);
  const gender: Gender = preview ?? profile?.gender ?? "unspecified";
  const value = useMemo<ThemeState>(() => ({ ...palettes[gender], gender, setPreviewGender: setPreview }), [gender]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
