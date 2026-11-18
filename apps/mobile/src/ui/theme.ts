/** Design tokens from the Figma file "Khisha — App Design" (Foundations page). */
export const colors = {
  bgApp: "#EEEEF0",
  surface: "#FFFFFF",
  ink: "#111114",
  textSecondary: "#6B6B76",
  textOnGradient: "#FFFFFF",
  border: "#E2E2E6",
  statusVerified: "#157A52",
  statusConfirm: "#A85F00",
  statusError: "#C23636",
  tintViolet: "rgba(91,63,176,0.10)",
  tintVerified: "rgba(21,122,82,0.13)",
  violetStart: "#5B3FB0",
  violetEnd: "#B58BE0",
} as const;

export const gradients = {
  violet: [colors.violetStart, colors.violetEnd],
} as const;

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
