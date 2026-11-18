import * as SecureStore from "expo-secure-store";

/**
 * Storage adapter for the Supabase session, backed by the iOS Keychain (expo-secure-store).
 * SecureStore warns about values over ~2 KB and a session token is larger than that,
 * so values are split into chunks. Keys may only contain letters, digits, ".", "-" and "_".
 */
const CHUNK_SIZE = 1800;
const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw === null) return null;
    const count = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count < 1) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // incomplete value: treat as signed out
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(countKey(key), String(count));
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    const count = countRaw === null ? 0 : Number.parseInt(countRaw, 10) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
