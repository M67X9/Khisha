import { Alexandria_400Regular, Alexandria_500Medium, Alexandria_600SemiBold } from "@expo-google-fonts/alexandria";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";

/** Loads Inter (English) and Alexandria (Arabic). Returns true when they are ready (or failed to load, so the app still opens). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Alexandria_400Regular,
    Alexandria_500Medium,
    Alexandria_600SemiBold,
  });
  return loaded || Boolean(error);
}
