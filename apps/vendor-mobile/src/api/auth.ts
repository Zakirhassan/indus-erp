import type { Role, User } from "@indus/shared-types";
import { api } from "../lib/apiClient";

export interface LoginResult {
  token: string;
  userId: string;
  name: string;
  role: Role;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return api.post<LoginResult>("/api/auth/login", { email, password });
}

export async function me(): Promise<User> {
  return api.get<User>("/api/auth/me");
}
