import jwt from "jsonwebtoken";
import { config } from "@indus/config";
import type { Role } from "@indus/shared-types";

export interface AccessTokenPayload {
  userId: string;
  role: Role;
}

const ACCESS_TOKEN_TTL = "12h";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload & jwt.JwtPayload;
}
