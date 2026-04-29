import type { FastifyReply, FastifyRequest } from "fastify";

import { findUserById, verifyAccessToken } from "../services/auth-service";

type AuthUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>;

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    authUserId?: string;
  }
}

export async function attachAuthUser(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) return;
  const token = header.slice(7).trim();
  if (!token) return;
  try {
    const userId = verifyAccessToken(token);
    const user = await findUserById(userId);
    if (user) {
      request.authUser = user;
      request.authUserId = user.id;
    }
  } catch {
    // Invalid/expired token — leave request unauthenticated.
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await attachAuthUser(request);
  if (!request.authUser) {
    return reply
      .status(401)
      .send({ message: "Avtorizatsiya talab qilinadi." });
  }
}
