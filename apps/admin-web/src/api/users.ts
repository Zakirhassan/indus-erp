import type { Role, User } from "@indus/shared-types";
import { api } from "../lib/apiClient";

export async function listUsers(): Promise<User[]> {
  return api.get<User[]>("/api/users");
}

export interface InviteUserInput {
  name: string;
  email: string;
  role: Role;
  fieldIds: string[];
}

export interface InviteUserResult extends User {
  /** One-time temporary password — there's no invite-email delivery yet, so relay it to the invitee directly. */
  tempPassword: string;
}

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  return api.post<InviteUserResult>("/api/users", input);
}
