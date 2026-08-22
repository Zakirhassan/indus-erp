import type { Role, User } from "@indus/shared-types";
import { api } from "../lib/apiClient";
import { clearSession, setSession, getSession, type Session } from "../mock/session";

interface LoginResponse {
  token: string;
  userId: string;
  name: string;
  role: Role;
}

/** Validates the current session's token against the server (also used to revalidate on app load). */
export async function me(): Promise<User> {
  return api.get<User>("/api/auth/me");
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await api.post<LoginResponse>("/api/auth/login", { email, password });
  const session: Session = { token: res.token, userId: res.userId, name: res.name, role: res.role };
  setSession(session);
  return session;
}

export function logout() {
  clearSession();
}

export function currentSession(): Session | null {
  return getSession();
}
