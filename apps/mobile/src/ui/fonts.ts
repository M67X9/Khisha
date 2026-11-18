import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_600SemiBold } from "@expo-google-fonts/noto-sans-arabic";
import { useFonts } from "expo-font";

/** Loads Inter and Noto Sans Arabic. Returns true when they are ready (or failed to load, so the app still opens). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    NotoSansArabic_400Regular,
    NotoSansArabic_500Medium,
    NotoSansArabic_600SemiBold,
  });
  return loaded || Boolean(error);
}
