import { Text, type TextProps } from "react-native";

import { useI18n } from "../i18n";
import { colors } from "./theme";
import { fontFamily, scale, type Variant } from "./typography";

type Props = TextProps & { variant?: Variant; color?: string };

/** Text in the right font and size for the current language. */
export function AppText({ variant = "body", color = colors.ink, style, ...rest }: Props) {
  const { lang, isRTL } = useI18n();
  const s = scale[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fontFamily(lang, s.weight),
          fontSize: s.size,
          lineHeight: s.lineHeight + (lang === "ar" ? 4 : 0),
          color,
          // "left" means the start edge: React Native swaps left and right in right-to-left mode.
          textAlign: "left",
          writingDirection: isRTL ? "rtl" : "ltr",
        },
        style,
      ]}
    />
  );
}
