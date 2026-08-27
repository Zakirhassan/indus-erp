import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Role } from "@indus/shared-types";

export interface Session {
  token: string;
  userId: string;
  name: string;
  role: Role;
}

const KEY = "indus-erp-session";

// expo-secure-store has no web backend (its web module is an empty stub), so
// every call throws "is not a function" in a browser. Fall back to
// AsyncStorage there; native platforms keep using the OS keychain/keystore.
const isWeb = Platform.OS === "web";

export async function getSession(): Promise<Session | null> {
  const raw = isWeb ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function setSession(session: Session): Promise<void> {
  const value = JSON.stringify(session);
  if (isWeb) {
    await AsyncStorage.setItem(KEY, value);
  } else {
    await SecureStore.setItemAsync(KEY, value);
  }
}

export async function clearSession(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(KEY);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
