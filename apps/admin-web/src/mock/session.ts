import type { Role } from "@indus/shared-types";

export interface Session {
  token: string;
  userId: string;
  name: string;
  role: Role;
}

const KEY = "indus-erp-admin-web:session:v1";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
