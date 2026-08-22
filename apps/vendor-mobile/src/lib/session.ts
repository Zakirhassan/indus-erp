import * as SecureStore from "expo-secure-store";
import type { Role } from "@indus/shared-types";

export interface Session {
  token: string;
  userId: string;
  name: string;
  role: Role;
}

const KEY = "indus-erp-session";

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function setSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
