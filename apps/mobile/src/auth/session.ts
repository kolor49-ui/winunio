import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "winunio_access_token";

export async function saveAccessToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearAccessToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
