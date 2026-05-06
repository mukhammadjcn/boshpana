import { BunkerCardType, GameType, RoomMode, RoomVisibility } from "@prisma/client";
import { FastifyInstance } from "fastify";

import { requireAuth } from "../lib/auth-decorator";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { findActiveRoomForUser } from "../services/active-room-service";
import { countHostedRoomsLast30d } from "../services/auth-service";
import { MatchmakingService } from "../services/matchmaking-service";
import { GameRegistry } from "../games/registry";

type RouteDeps = {
  games: GameRegistry;
};

export async function registerPublicRoutes(app: FastifyInstance, deps: RouteDeps) {
  const matchmaking = new MatchmakingService(deps.games);

  app.get("/health", async () => ({ ok: true }));

  app.post<{
    Body: {
      gameType?: GameType;
      hostName: string;
      sessionId: string;
      // Online flow only — defaults preserve Friends behavior.
      mode?: RoomMode;
      visibility?: RoomVisibility;
      // Lets the client retry after the user picks "Start new game" in the
      // active-room modal — we leave the existing room before creating.
      confirmLeaveExisting?: boolean;
      // Bunker-only fields (ignored for Mafia)
      winnerTarget?: number;
      isAdult?: boolean;
      // Mafia-only fields (ignored for Bunker)
      mafiaCount?: number;
      hasSheriff?: boolean;
      hasDoctor?: boolean;
      // Shared
      maxPlayers?: number;
    };
  }>(
    "/api/rooms/create",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = request.authUser!;
        const body = request.body;
        const mode = body.mode ?? RoomMode.FRIENDS;
        const gameType = body.gameType ?? GameType.BUNKER;

        // 1 user = 1 active room. Friends preserves the existing implicit
        // behavior; only ONLINE rooms gate behind this check so the
        // friends-mode flow stays exactly as it was.
        if (mode === RoomMode.ONLINE) {
          const active = await enforceSingleActiveRoom(
            user.id,
            body.confirmLeaveExisting,
            body.sessionId,
            deps.games,
          );
          if (active.kind === "blocked") {
            return reply.status(409).send(active.payload);
          }
        }

        const recentCount = await countHostedRoomsLast30d(user.id);
        if (recentCount >= env.roomCreationLimit) {
          return reply.status(429).send({
            message: `Limit yetdi: 30 kunda ${env.roomCreationLimit} ta xonadan ortiq yarata olmaysiz.`
          });
        }

        if (mode === RoomMode.ONLINE) {
          const visibility = body.visibility ?? RoomVisibility.PRIVATE;
          if (gameType === GameType.MAFIA) {
            const result = await deps.games.onlineMafia.createRoom({
              hostName: body.hostName,
              sessionId: body.sessionId,
              hostUserId: user.id,
              visibility,
              mafiaCount: body.mafiaCount,
              hasSheriff: body.hasSheriff,
              hasDoctor: body.hasDoctor,
            });
            return reply.send(result);
          }
          const result = await deps.games.onlineBunker.createRoom({
            hostName: body.hostName,
            sessionId: body.sessionId,
            hostUserId: user.id,
            visibility,
            winnerTarget: body.winnerTarget,
            isAdult: body.isAdult,
          });
          return reply.send(result);
        }

        if (gameType === GameType.MAFIA) {
          const result = await deps.games.mafia.createRoom({
            hostName: body.hostName,
            sessionId: body.sessionId,
            hostUserId: user.id,
            maxPlayers: body.maxPlayers,
            mafiaCount: body.mafiaCount ?? 2,
            hasSheriff: body.hasSheriff ?? true,
            hasDoctor: body.hasDoctor ?? true
          });
          return reply.send(result);
        }

        const result = await deps.games.bunker.createRoom({
          hostName: body.hostName,
          sessionId: body.sessionId,
          hostUserId: user.id,
          maxPlayers: body.maxPlayers,
          winnerTarget: body.winnerTarget ?? 1,
          isAdult: body.isAdult
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post<{
    Body: {
      gameType: GameType;
      hostName: string;
      sessionId: string;
      isAdult?: boolean;
      confirmLeaveExisting?: boolean;
    };
  }>(
    "/api/rooms/matchmake",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = request.authUser!;
        const body = request.body;

        const active = await enforceSingleActiveRoom(
          user.id,
          body.confirmLeaveExisting,
          body.sessionId,
          deps.games,
        );
        if (active.kind === "blocked") {
          return reply.status(409).send(active.payload);
        }

        const result = await matchmaking.findOrCreatePublicRoom({
          gameType: body.gameType,
          hostName: body.hostName,
          sessionId: body.sessionId,
          hostUserId: user.id,
          isAdult: body.isAdult,
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ message: (error as Error).message });
      }
    },
  );

  app.post<{
    Params: { code: string };
    Body: {
      name: string;
      sessionId: string;
    };
  }>(
    "/api/rooms/:code/join",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const code = request.params.code.toUpperCase();
        const room = await prisma.room.findUnique({
          where: { code },
          select: { gameType: true }
        });
        if (!room) {
          return reply.status(404).send({ message: "Xona topilmadi." });
        }
        const service = deps.games.for(room.gameType);
        const result = await service.joinRoom({
          code,
          ...request.body,
          userId: request.authUserId
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ message: (error as Error).message });
      }
    }
  );

  // Lightweight, game-agnostic room metadata. The frontend room/game pages
  // call this first so they can route to the correct per-game experience
  // (Bunker / Mafia / ...) before fetching the full game state. `mode`
  // and `visibility` let the router pick the online vs friends UI.
  app.get<{ Params: { code: string } }>(
    "/api/rooms/:code/info",
    async (request, reply) => {
      const room = await prisma.room.findUnique({
        where: { code: request.params.code.toUpperCase() },
        select: {
          code: true,
          gameType: true,
          status: true,
          mode: true,
          visibility: true,
        },
      });
      if (!room) {
        return reply.status(404).send({ message: "Xona topilmadi." });
      }
      return reply.send(room);
    }
  );

  app.get<{
    Params: { code: string };
    Querystring: { sessionId: string };
  }>("/api/rooms/:code/state", async (request, reply) => {
    try {
      const code = request.params.code.toUpperCase();
      const room = await prisma.room.findUnique({
        where: { code },
        select: { gameType: true }
      });
      if (!room) {
        return reply.status(404).send({ message: "Xona topilmadi." });
      }
      const service = deps.games.for(room.gameType);
      const result = await service.getRoomState(code, request.query.sessionId);
      return reply.send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get("/api/meta/card-types", async () => ({
    items: BunkerCardType
  }));
}

// Enforces "1 user = 1 active room" for online flows. If the user already
// has a LOBBY/PLAYING room and `confirmLeave` is false, returns a blocked
// envelope the route will turn into 409 + ACTIVE_ROOM_EXISTS so the
// client can show the "Continue or start new?" modal. With confirmLeave,
// the existing room is left first via the per-game leaveRoom action and
// the caller proceeds with create/matchmake.
async function enforceSingleActiveRoom(
  userId: string,
  confirmLeave: boolean | undefined,
  sessionId: string,
  games: GameRegistry,
): Promise<
  | { kind: "ok" }
  | {
      kind: "blocked";
      payload: {
        code: "ACTIVE_ROOM_EXISTS";
        message: string;
        activeRoom: NonNullable<Awaited<ReturnType<typeof findActiveRoomForUser>>>;
      };
    }
> {
  const active = await findActiveRoomForUser(userId);
  if (!active) return { kind: "ok" };

  if (!confirmLeave) {
    return {
      kind: "blocked",
      payload: {
        code: "ACTIVE_ROOM_EXISTS",
        message: "Sizning aktiv o'yiningiz bor.",
        activeRoom: active,
      },
    };
  }

  // User confirmed — leave the existing room before proceeding. Best-effort:
  // if the leave fails (e.g. room was just cleaned up) we still let the
  // create/matchmake go through.
  try {
    const service = games.for(active.gameType);
    await service.leaveRoom({ code: active.code, sessionId });
    const broadcaster = service as typeof service & {
      broadcastState?: (roomCode: string) => Promise<void>;
    };
    await broadcaster.broadcastState?.(active.code);
  } catch {
    // ignore
  }
  return { kind: "ok" };
}
