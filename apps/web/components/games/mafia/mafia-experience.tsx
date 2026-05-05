"use client";

import type { Route } from "next";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CancelledRoomModal } from "@/components/cancelled-room-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { LobbyShareActions } from "@/components/lobby-share-actions";
import { RoomExpiredState } from "@/components/room-expired-state";
import { TelegramChrome } from "@/components/telegram-chrome";
import { apiRequest } from "@/lib/api";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import { pushToast } from "@/store/useToastStore";

import { MafiaDay } from "./mafia-day";
import { MafiaFinished } from "./mafia-finished";
import { MafiaNight } from "./mafia-night";
import { MafiaNightResult } from "./mafia-night-result";
import {
  getMafiaRoleMeta,
  MafiaRoleCardContent,
} from "./mafia-role-card-content";
import { MafiaRoleReveal } from "./mafia-role-reveal";
import type { MafiaPublicState } from "./mafia-types";
import { useMafiaAudio } from "./use-mafia-audio";

type MafiaExperienceProps = {
  roomCode: string;
  view: "room" | "game";
};

// Stage 2: lobby UI is fully wired. The in-game phases (role-reveal,
// night, day discussion, day vote, finished) ship in following
// commits — for now we render a placeholder once room.status flips to
// PLAYING / FINISHED so the host's "Start" still has somewhere to
// land while the rest of the screens are built.
export function MafiaExperience({ roomCode, view }: MafiaExperienceProps) {
  const router = useRouter();
  const { t } = useI18n();
  const normalizedRoomCode = roomCode.toUpperCase();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<MafiaPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(true);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [joinName, setJoinName] = useState("");
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const [eliminatedModalOpen, setEliminatedModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [kickedModalOpen, setKickedModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [phaseIntro, setPhaseIntro] = useState<{
    kind: "night" | "day" | "tiebreak";
    key: string;
  } | null>(null);
  const connectedRef = useRef(false);
  // Tracks which (roomCode, playerId) pairs already saw the cancelled
  // modal so reconnects / state refetches don't keep popping it back.
  const seenCancelledModalRef = useRef<Set<string>>(new Set());
  const seenSelfEliminationRef = useRef<Set<string>>(new Set());
  const seenPhaseIntroRef = useRef<Set<string>>(new Set());
  const isLeavingRef = useRef(false);
  const previousMeRef = useRef<MafiaPublicState["me"]>(null);
  const closingConfirmation =
    !!roomState?.room &&
    roomState.room.status !== "FINISHED" &&
    roomState.room.status !== "CANCELLED";
  const patchTimer = useCallback((remainingSeconds: number) => {
    setRoomState((state) =>
      state
        ? {
            ...state,
            game: {
              ...state.game,
              remainingSeconds,
            },
          }
        : state,
    );
  }, []);

  const refreshState = useCallback(() => {
    if (!sessionId) return;
    void apiRequest<MafiaPublicState>(
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
    )
      .then((s) => {
        setRoomState(s);
        setLoading(false);
      })
      .catch(() => undefined);
  }, [roomCode, sessionId]);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Detect kicked player
  useEffect(() => {
    const prevMe = previousMeRef.current;
    const currentMe = roomState?.me;
    const status = roomState?.room.status;

    if (
      prevMe &&
      !currentMe &&
      status !== "CANCELLED" &&
      status !== "FINISHED" &&
      !isLeavingRef.current
    ) {
      setKickedModalOpen(true);
    }
    previousMeRef.current = currentMe ?? null;
  }, [roomState?.me, roomState?.room.status]);

  useEffect(() => {
    if (!pendingAction) return;
    const timer = window.setTimeout(() => {
      setPendingAction(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [pendingAction]);

  // Lobby vaqtida host xonani tugatib yuborsa room CANCELLED bo'ladi
  // va o'yin umuman boshlanmaydi. Har bir ishtirokchiga "o'yin
  // yaratilmadi" modal bir marta chiqsin va bosh sahifaga
  // yo'naltirsin. Bunker bilan bir xil pattern.
  useEffect(() => {
    if (roomState?.room.status !== "CANCELLED") return;
    if (!roomState.me) return;
    if (roomState.me.isHost) {
      router.replace("/dashboard" as Route);
      return;
    }
    const code = roomState.room.code;
    const meId = roomState.me.id;
    const key = `cancelled-${code}-${meId}`;
    if (seenCancelledModalRef.current.has(key)) return;
    seenCancelledModalRef.current.add(key);
    setCancelledModalOpen(true);
  }, [
    router,
    roomState?.room.status,
    roomState?.room.code,
    roomState?.me?.id,
    roomState?.me?.isHost,
  ]);

  // Warm the browser cache for every situation banner used during a
  // Mafia round (ghost / victim / doctor save / peaceful night / talk
  // / no-vote / winner banners). By the time the night/day cards
  // animate in, their artwork is already cached locally.
  useEffect(() => {
    const sources = [
      "/mafia/ghost.webp",
      "/mafia/died.webp",
      "/mafia/doctor.webp",
      "/mafia/day.webp",
      "/mafia/day-banner.webp",
      "/mafia/night-banner.webp",
      "/mafia/talk.webp",
      "/mafia/no-voice.webp",
      "/mafia/mafia.webp",
      "/mafia/city.webp",
    ];
    for (const src of sources) {
      const img = new window.Image();
      img.src = src;
    }
  }, []);

  // Prefill the join nickname from the cached auth profile so the
  // invitee can tap "Roomga kirish" without retyping their name. Same
  // pattern as the Bunker experience.
  useEffect(() => {
    if (joinName) return;
    const authUser = getAuthUser();
    const fallback =
      authUser?.nickname ??
      authUser?.firstName ??
      authUser?.telegramUsername ??
      "";
    if (fallback) setJoinName(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial state fetch — same pattern as Bunker.
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void (async () => {
      try {
        const data = await apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        );
        if (!active) return;
        setRoomState(data);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [roomCode, sessionId]);

  // Auto-route between /room and /game based on room.status — same as
  // Bunker so a host pressing "Start" pulls everyone forward.
  useEffect(() => {
    if (!roomState) return;
    if (view === "room" && roomState.room.status !== "LOBBY") {
      router.replace(`/game/${roomCode}` as Route);
      return;
    }
    if (view === "game" && roomState.room.status === "LOBBY") {
      router.replace(`/room/${roomCode}` as Route);
    }
  }, [roomState, view, roomCode, router]);

  // Socket lifecycle — mirrors Bunker's reconnect-friendly setup.
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;

    const socket = getSocket();
    let isReconnect = false;

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_room", { roomCode, sessionId });
      if (isReconnect) {
        void apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
      }
      isReconnect = true;
    };

    const onDisconnect = () => setSocketConnected(false);
    const onState = (s: MafiaPublicState) => {
      if (s.room.code !== normalizedRoomCode) return;
      setRoomState(s);
      setLoading(false);
    };
    const onTimer = ({ remainingSeconds }: { remainingSeconds: number }) => {
      patchTimer(remainingSeconds);
    };
    const onErr = ({ message }: { message: string }) => {
      pushToast({ kind: "error", text: message });
      setError(message);
      setPendingAction(null);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) {
        socket.connect();
      } else {
        void apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onState);
    socket.on("timer_update", onTimer);
    socket.on("action_error", onErr);
    document.addEventListener("visibilitychange", onVisibility);
    socket.connect();
    connectedRef.current = true;

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onState);
      socket.off("timer_update", onTimer);
      socket.off("action_error", onErr);
      document.removeEventListener("visibilitychange", onVisibility);
      connectedRef.current = false;
    };
  }, [normalizedRoomCode, patchTimer, roomCode, sessionId]);

  function emit(event: string, payload?: Record<string, unknown>) {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit(event, { roomCode, sessionId, ...(payload ?? {}) });
  }

  function emitWithPending(
    actionKey: string,
    event: string,
    payload?: Record<string, unknown>,
  ) {
    setPendingAction(actionKey);
    emit(event, payload);
    window.setTimeout(() => refreshState(), 350);
    window.setTimeout(() => refreshState(), 1200);
  }

  // Join handler — mirrors Bunker. Hits the HTTP endpoint, then
  // re-emits join_room over the socket so the room state broadcast
  // reflects the new player immediately for everyone in the lobby.
  async function joinWithName(name: string) {
    if (!sessionId) return;
    await apiRequest(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      body: JSON.stringify({ name, sessionId }),
    });
    const socket = getSocket();
    socket.emit("join_room", { roomCode, sessionId });
    const fresh = await apiRequest<MafiaPublicState>(
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
    );
    setRoomState(fresh);
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    try {
      await joinWithName(joinName.trim());
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  const meId = roomState?.me?.id ?? null;
  const phase = roomState?.game.phase ?? null;
  const nightNumber = roomState?.game.nightNumber ?? 0;
  const dayNumber = roomState?.game.dayNumber ?? 0;
  const lastNightVictims = roomState?.game.lastNightVictims ?? [];
  const lastEliminatedPlayerId = roomState?.game.lastEliminatedPlayerId ?? null;
  const alivePlayers =
    roomState?.players.filter((player) => player.isAlive) ?? [];
  const tiebreakCandidateIds = roomState?.game.tiebreakCandidateIds ?? [];
  const meIsTiebreakCandidate = !!meId && tiebreakCandidateIds.includes(meId);
  const allAliveAreTied =
    tiebreakCandidateIds.length > 0 &&
    alivePlayers.length > 0 &&
    alivePlayers.every((player) => tiebreakCandidateIds.includes(player.id));
  const votingActive = phase === "DAY_VOTE" || phase === "DAY_TIEBREAK";
  const selfEliminationModalKey = useMemo(() => {
    if (!meId) return null;
    if (
      phase === "NIGHT_RESULT" &&
      lastNightVictims.some((victim) => victim.playerId === meId)
    ) {
      return `night-result-${nightNumber}-${meId}`;
    }
    if (phase === "DAY_RESULT" && lastEliminatedPlayerId === meId) {
      return `day-result-${dayNumber}-${meId}`;
    }
    return null;
  }, [
    dayNumber,
    lastEliminatedPlayerId,
    lastNightVictims,
    meId,
    nightNumber,
    phase,
  ]);

  useEffect(() => {
    if (!selfEliminationModalKey) return;
    if (seenSelfEliminationRef.current.has(selfEliminationModalKey)) return;
    seenSelfEliminationRef.current.add(selfEliminationModalKey);
    setEliminatedModalOpen(true);
  }, [selfEliminationModalKey]);

  useEffect(() => {
    if (!eliminatedModalOpen) return;
    setRoleModalOpen(false);
  }, [eliminatedModalOpen]);

  useEffect(() => {
    if (roleModalOpen) {
      setRoleModalVisible(true);
      return;
    }
    if (!roleModalVisible) return;
    const timer = window.setTimeout(() => {
      setRoleModalVisible(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [roleModalOpen, roleModalVisible]);

  useEffect(() => {
    setPendingAction(null);
  }, [
    roomState?.room.status,
    roomState?.game.phase,
    roomState?.me?.roleConfirmed,
    roomState?.me?.pendingNightTargetId,
    roomState?.votes.myTargetPlayerId,
    roomState?.votes.confirmedByMe,
    roomState?.night?.confirmedByMe,
  ]);

  useEffect(() => {
    if (!roleModalOpen) return;
    if (roomState?.room.status !== "PLAYING") return;
    if (roomState?.game.phase === "ASSIGN_ROLES") return;
    const timer = window.setTimeout(() => {
      setRoleModalOpen(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [roleModalOpen, roomState?.game.phase, roomState?.room.status]);

  useEffect(() => {
    if (roomState?.room.status !== "PLAYING") return;
    if (
      phase !== "NIGHT" &&
      phase !== "DAY_DISCUSSION" &&
      phase !== "DAY_TIEBREAK"
    ) {
      return;
    }

    const key =
      phase === "NIGHT"
        ? `night-${roomState.game.nightNumber}`
        : phase === "DAY_TIEBREAK"
          ? `tiebreak-${roomState.game.dayNumber}`
          : `day-${roomState.game.dayNumber}`;
    if (seenPhaseIntroRef.current.has(key)) return;
    seenPhaseIntroRef.current.add(key);

    setPhaseIntro({
      kind:
        phase === "NIGHT"
          ? "night"
          : phase === "DAY_TIEBREAK"
            ? "tiebreak"
            : "day",
      key,
    });
    const timer = window.setTimeout(
      () => {
        setPhaseIntro((current) => (current?.key === key ? null : current));
      },
      phase === "DAY_TIEBREAK" ? 2000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [
    phase,
    roomState?.game.dayNumber,
    roomState?.game.nightNumber,
    roomState?.room.status,
  ]);

  useMafiaAudio({
    votingActive,
    selfEliminationAudioKey: eliminatedModalOpen
      ? selfEliminationModalKey
      : null,
  });

  const selfEliminationModal = eliminatedModalOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
    >
      <div className="absolute inset-0" />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border-t border-bad/40 bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.22), transparent 55%), linear-gradient(180deg, rgba(239,68,68,0.04) 0%, rgba(11,13,18,0) 60%)",
        }}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        <div className="px-6 pt-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-bad/30 bg-bad/10">
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-bad"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-bad">
            {t("eliminatsiya")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink-primary">
            {t("siz_oyindan_chiqdingiz")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t("siz_endi_bu_raundda_qatnasha_df26")}
          </p>
        </div>

        <div className="px-5 pt-5 pb-5">
          <button
            onClick={() => setEliminatedModalOpen(false)}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {t("kuzatishda_davom_etish")}
          </button>
        </div>
      </div>
    </div>
  ) : null;
  const myRoleMeta = getMafiaRoleMeta(roomState?.me?.role ?? null);
  const showRoleReminder =
    roomState?.room.status === "PLAYING" &&
    roomState?.game.phase !== "ASSIGN_ROLES" &&
    !!roomState?.me?.role &&
    !eliminatedModalOpen;
  const showVoteConfirmAction =
    !!roomState?.me?.role &&
    !!roomState?.me?.isAlive &&
    (phase !== "DAY_TIEBREAK" || !meIsTiebreakCandidate || allAliveAreTied) &&
    (roomState?.game.phase === "DAY_VOTE" ||
      roomState?.game.phase === "DAY_TIEBREAK");
  const showNightSelectionStatus =
    roomState?.game.phase === "NIGHT" &&
    !!roomState?.me?.role &&
    !!roomState?.me?.isAlive;
  const isPending = (actionKey: string) => pendingAction === actionKey;
  const roleReminderModal =
    roleModalVisible && roomState?.me?.role && myRoleMeta ? (
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay/90 backdrop-blur-md transition duration-200 sm:items-center ${
          roleModalOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="absolute inset-0"
          onClick={() => setRoleModalOpen(false)}
        />
        <div
          className={`relative z-10 w-full max-w-xl px-5 transition duration-200 sm:px-0 ${
            roleModalOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.98] opacity-0"
          }`}
        >
          <div
            className="overflow-hidden rounded-3xl border border-line-strong bg-bg-surface shadow-pop"
            style={{ backgroundImage: myRoleMeta.bgGradient }}
          >
            <MafiaRoleCardContent state={roomState} className="py-10" />
          </div>
        </div>
      </div>
    ) : null;
  const phaseIntroArt = phaseIntro
    ? phaseIntro.kind === "night"
      ? "/mafia/night-banner.webp"
      : phaseIntro.kind === "day"
        ? "/mafia/day-banner.webp"
        : null
    : null;
  const phaseIntroModal = phaseIntro ? (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-overlay/90 px-5 backdrop-blur-md"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(247,181,79,0.16),transparent_40%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-line-strong bg-bg-surface text-center shadow-pop">
        <div className="relative">
          <div className="relative aspect-[4/3] w-full">
            {phaseIntroArt ? (
              <Image
                src={phaseIntroArt}
                alt={
                  phaseIntro.kind === "night"
                    ? t("tun_boshlanmoqda")
                    : phaseIntro.kind === "tiebreak"
                      ? t("qayta_ovoz_boshlanmoqda")
                      : t("kun_boshlanmoqda")
                }
                fill
                sizes="(max-width: 640px) 90vw, 420px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-surface/85 via-transparent to-transparent" />
        </div>
        <div className="px-6 pb-7 pt-5">
          {phaseIntro.kind === "tiebreak" ? (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/35 bg-brand/12 text-brand">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3v18" />
                <path d="M7 8h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />
              </svg>
            </div>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand">
            {phaseIntro.kind === "night"
              ? t("tun_boshlanmoqda")
              : phaseIntro.kind === "tiebreak"
                ? t("qayta_ovoz_boshlanmoqda")
                : t("kun_boshlanmoqda")}
          </p>
          {/* <h2 className="mt-3 text-3xl font-bold text-ink-primary">
            {phaseIntro.kind === "night"
              ? t("tun_yaqin")
              : phaseIntro.kind === "tiebreak"
                ? t("ovozlar_teng_boldi")
                : t("kun_yorishdi")}
          </h2> */}
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {phaseIntro.kind === "night"
              ? t("tun_yaqin_tavsifi")
              : phaseIntro.kind === "tiebreak"
                ? meIsTiebreakCandidate && !allAliveAreTied
                  ? t("siz_qayta_ovoz_nomzodisiz")
                  : t("ovozlar_teng_boldi_qayta_ovoz_bering")
                : t("kun_yorishdi_tavsifi")}
          </p>
          <p className="mt-5 text-xs text-ink-muted">
            {phaseIntro.kind === "tiebreak"
              ? t("jarayon_2_soniyadan_keyin_davom_etadi")
              : t("jarayon_5_soniyadan_keyin_davom_etadi")}
          </p>
        </div>
      </div>
    </div>
  ) : null;
  const playingEndGameModal = (
    <ConfirmModal
      open={endGameConfirmOpen}
      title={t("oyinni_tugatishni_tasdiqlang")}
      description={t("oyin_toxtatiladi_va_barcha_oyinchilar_2aa4")}
      confirmLabel={t("ha_tugatish")}
      tone="danger"
      onConfirm={() => {
        setEndGameConfirmOpen(false);
        emit("end_game");
      }}
      onClose={() => setEndGameConfirmOpen(false)}
    />
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        <TelegramChrome backHref="/dashboard" />
        {t("yuklanmoqda_2")}
      </main>
    );
  }

  if (!roomState) {
    return <RoomExpiredState roomCode={roomCode} detail={error} />;
  }

  const { room, players, me, game } = roomState;

  // Visitor (link recipient) hasn't joined yet — surface the right
  // call-to-action depending on room status and auth state. Mirrors
  // Bunker's invite flow.
  if (!me) {
    if (kickedModalOpen) {
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-3xl border border-bad/40 bg-bg-surface p-6 text-center shadow-pop">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-bad/40 bg-bad/10 text-2xl text-bad">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </div>
              <h3 className="mt-4 text-xl font-bold text-ink-primary">
                {t("sizni_oyindan_chiqarishdi")}
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {t("host_sizni_oyindan_chiqarib_yubordi_f51a")}
              </p>
              <button
                type="button"
                onClick={() => router.push("/dashboard" as Route)}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
              >
                {t("bosh_sahifa")}
              </button>
            </div>
          </div>
        </main>
      );
    }

    if (room.status !== "LOBBY") {
      const finished =
        room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <TelegramChrome backHref="/dashboard" />
          <div className="mx-auto max-w-md pt-6">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${
                finished ? "text-bad" : "text-warn"
              }`}
            >
              {finished ? t("yopiq") : t("boshlangan")}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {finished
                ? t("bu_oyin_yakunlangan")
                : t("bu_oyin_allaqachon_boshlangan")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {finished
                ? t("yangi_oyin_yarating_yoki_ochiq_e3ed")
                : t("oyin_boshlanganidan_keyin_yangi_oyinchi_6d01")}
            </p>
            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">{t("room_code")}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard" as Route)}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("bosh_sahifa")}
            </button>
          </div>
        </main>
      );
    }

    if (!getAuthToken()) {
      const loginHref = `/login?redirect=${encodeURIComponent(`/room/${roomCode}`)}`;
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <TelegramChrome backHref="/dashboard" />
          <div className="mx-auto max-w-md pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("taklif_mafia")}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {t("roomga_kirish_uchun_tizimga_kiring")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {t("roomga_qoshilish_uchun_bot_orqali_123f")}
            </p>
            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">{t("room_code")}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>
            <a
              href={loginHref}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              <span aria-hidden>✈</span>
              {t("telegramda_kirish")}
            </a>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
        <div className="mx-auto max-w-md pt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            {t("taklif_mafia")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {t("roomga_kirish_uchun_nickname_yozing")}
          </h1>
          <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <p className="text-xs text-ink-muted">{t("room_code")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
              {roomCode}
            </p>
          </div>
          <form onSubmit={handleJoin} className="mt-5 grid gap-3">
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
              maxLength={20}
              className="h-14 rounded-2xl border border-line-strong bg-bg-surface px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
              placeholder={t("nickname")}
            />
            <button className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]">
              {t("roomga_kirish")}
            </button>
          </form>
          {error ? (
            <p className="mt-3 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  // Lobby view (room.status === LOBBY)
  if (room.status === "LOBBY") {
    return (
      <>
        <TelegramChrome
          backHref="/dashboard"
          closingConfirmation={closingConfirmation}
        />
        <Lobby
          room={room}
          game={game}
          players={players}
          me={me}
          socketConnected={socketConnected}
          startGamePending={isPending("lobby:start_game")}
          onStartGame={() => emitWithPending("lobby:start_game", "start_game")}
          onLeaveRoom={() => setLeaveConfirmOpen(true)}
          onRequestKickPlayer={(player) => setKickTarget(player)}
          onRequestEndGame={() => setEndGameConfirmOpen(true)}
        />
        <ConfirmModal
          open={endGameConfirmOpen}
          title={t("roomni_ochirishni_tasdiqlang")}
          description={t("lobby_bekor_qilinadi_va_barcha_a11a")}
          confirmLabel={t("roomni_ochirish")}
          tone="danger"
          onConfirm={() => {
            setEndGameConfirmOpen(false);
            emit("end_game");
            router.push("/dashboard" as Route);
          }}
          onClose={() => setEndGameConfirmOpen(false)}
        />
        <ConfirmModal
          open={!!kickTarget}
          title={
            kickTarget
              ? t("name_ni_chiqarish_2", { name: kickTarget.name })
              : ""
          }
          description={t("bu_oyinchi_roomdan_chiqarib_yuboriladi_e248")}
          confirmLabel={t("chiqarish")}
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            if (kickTarget) {
              emit("kick_player", { targetPlayerId: kickTarget.id });
            }
            setKickTarget(null);
          }}
          onClose={() => setKickTarget(null)}
        />
        <ConfirmModal
          open={leaveConfirmOpen}
          title={t("roomdan_chiqasizmi")}
          description={t("siz_xonadan_chiqasiz_va_oyin_a97d")}
          confirmLabel={t("ha_chiqish")}
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            isLeavingRef.current = true;
            emit("leave_room");
            setLeaveConfirmOpen(false);
            router.push("/dashboard" as Route);
          }}
          onClose={() => setLeaveConfirmOpen(false)}
        />
      </>
    );
  }

  // ASSIGN_ROLES — har o'yinchi rolini ko'radi va tasdiqlaydi. Hamma
  // tasdiqlagach, host birinchi tunni boshlaydi.
  if (game.phase === "ASSIGN_ROLES" && room.status === "PLAYING") {
    return (
      <>
        <TelegramChrome
          backHref="/dashboard"
          closingConfirmation={closingConfirmation}
        />
        <MafiaRoleReveal
          state={roomState}
          confirmPending={isPending("mafia:confirm_role")}
          onConfirm={() =>
            emitWithPending("mafia:confirm_role", "mafia:confirm_role")
          }
        />
        <MafiaHostDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onAdvancePhase={() =>
            emitWithPending("mafia:advance_phase", "mafia:advance_phase")
          }
          onEndGame={() => setEndGameConfirmOpen(true)}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        <MafiaPlayerDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {playingEndGameModal}
        {selfEliminationModal}
        {phaseIntroModal}
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // NIGHT — strict 20s window. Each role taps a target; server
  // resolves at the deadline.
  if (game.phase === "NIGHT" && room.status === "PLAYING") {
    return (
      <>
        <TelegramChrome
          backHref="/dashboard"
          closingConfirmation={closingConfirmation}
        />
        <MafiaNight
          state={roomState}
          onSubmit={(action, targetPlayerId) =>
            emitWithPending(
              "mafia:submit_night_action",
              "mafia:submit_night_action",
              { action, targetPlayerId },
            )
          }
        />
        <MafiaHostDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onAdvancePhase={() =>
            emitWithPending("mafia:advance_phase", "mafia:advance_phase")
          }
          onEndGame={() => setEndGameConfirmOpen(true)}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {playingEndGameModal}
        {selfEliminationModal}
        <MafiaPlayerDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {roleReminderModal}
        {phaseIntroModal}
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // NIGHT_RESULT — sequential reveal of victims and doctor save.
  if (game.phase === "NIGHT_RESULT" && room.status === "PLAYING") {
    return (
      <>
        <TelegramChrome
          backHref="/dashboard"
          closingConfirmation={closingConfirmation}
        />
        <MafiaNightResult state={roomState} />
        <MafiaHostDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onAdvancePhase={() =>
            emitWithPending("mafia:advance_phase", "mafia:advance_phase")
          }
          onEndGame={() => setEndGameConfirmOpen(true)}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {playingEndGameModal}
        {selfEliminationModal}
        <MafiaPlayerDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {roleReminderModal}
        {phaseIntroModal}
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // DAY phases — discussion / vote / tiebreak / result share one
  // component since they're variations of the same shell.
  if (
    (game.phase === "DAY_DISCUSSION" ||
      game.phase === "DAY_VOTE" ||
      game.phase === "DAY_TIEBREAK" ||
      game.phase === "DAY_RESULT") &&
    room.status === "PLAYING"
  ) {
    return (
      <>
        <TelegramChrome
          backHref="/dashboard"
          closingConfirmation={closingConfirmation}
        />
        <MafiaDay
          state={roomState}
          voteSubmitPending={isPending("mafia:submit_day_vote")}
          onSubmitVote={(targetPlayerId) =>
            emitWithPending("mafia:submit_day_vote", "mafia:submit_day_vote", {
              targetPlayerId,
            })
          }
        />
        <MafiaHostDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onAdvancePhase={() =>
            emitWithPending("mafia:advance_phase", "mafia:advance_phase")
          }
          onEndGame={() => setEndGameConfirmOpen(true)}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {playingEndGameModal}
        {selfEliminationModal}
        <MafiaPlayerDock
          state={roomState}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onOpenRole={() => setRoleModalOpen(true)}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
        />
        {roleReminderModal}
        {phaseIntroModal}
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // Game over — winner banner + role reveal grid. CANCELLED rooms
  // (host nuked the lobby before start) also land here because the
  // service flips game.phase to FINISHED in both endGame branches.
  if (
    game.phase === "FINISHED" ||
    room.status === "FINISHED" ||
    room.status === "CANCELLED"
  ) {
    return (
      <>
        <TelegramChrome backHref="/dashboard" />
        <MafiaFinished state={roomState} />
        {selfEliminationModal}
        <CancelledRoomModal
          open={cancelledModalOpen}
          onDismiss={() => {
            setCancelledModalOpen(false);
            router.push("/dashboard" as Route);
          }}
        />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // Fallback — should be unreachable because every (status, phase)
  // combination is handled above. Render the dashboard link so the
  // user isn't stuck on a blank screen if a new phase is added.
  return (
    <>
      <TelegramChrome
        backHref="/dashboard"
        closingConfirmation={closingConfirmation}
      />
      <main className="min-h-screen bg-bg-base text-ink-primary">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-3">
            <p className="text-sm font-semibold">{t("mafia_2")}</p>
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 text-xs text-ink-secondary">
              {room.code}
            </span>
          </header>

          <section className="mt-6 grid gap-4 rounded-2xl border border-dashed border-line-strong bg-bg-surface p-6 text-center">
            <p className="text-2xl">🚧</p>
            <p className="text-base font-semibold">{t("noma_lum_holat")}</p>
            <p className="text-sm text-ink-muted">
              {t("hozirgi_faza_phase", { phase: game.phase })}
            </p>
          </section>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard" as Route)}
              className="flex h-12 items-center justify-center rounded-xl bg-ok text-sm font-semibold text-bg-base"
            >
              {t("bosh_sahifaga_qaytish")}
            </button>
            {me?.isHost ? (
              <button
                type="button"
                onClick={() => setEndGameConfirmOpen(true)}
                className="flex h-12 items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad"
              >
                {t("oyinni_tugatish")}
              </button>
            ) : null}
          </div>
        </div>
      </main>
      <ConfirmModal
        open={endGameConfirmOpen}
        title={t("oyinni_tugatishni_tasdiqlang")}
        description={t("oyin_toxtatiladi_va_barcha_oyinchilar_2aa4")}
        confirmLabel={t("ha_tugatish")}
        tone="danger"
        onConfirm={() => {
          setEndGameConfirmOpen(false);
          emit("end_game");
        }}
        onClose={() => setEndGameConfirmOpen(false)}
      />
      {selfEliminationModal}
      {!socketConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            {t("qayta_ulanmoqda")}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MafiaHostDock({
  state,
  showRoleReminder,
  showVoteConfirmAction,
  showNightSelectionStatus,
  primaryPending,
  confirmVotePending,
  confirmNightPending,
  onAdvancePhase,
  onEndGame,
  onOpenRole,
  onConfirmVote,
  onConfirmNight,
}: {
  state: MafiaPublicState;
  showRoleReminder: boolean;
  showVoteConfirmAction: boolean;
  showNightSelectionStatus: boolean;
  primaryPending: boolean;
  confirmVotePending: boolean;
  confirmNightPending: boolean;
  onAdvancePhase: () => void;
  onEndGame: () => void;
  onOpenRole: () => void;
  onConfirmVote: () => void;
  onConfirmNight: () => void;
}) {
  const { t } = useI18n();
  const me = state.me;
  if (!me?.isHost || state.room.status !== "PLAYING") return null;
  if (state.game.phase === "ASSIGN_ROLES" && !me.roleConfirmed) return null;

  const primaryLabel = getMafiaHostPrimaryLabel(state);
  const primaryDisabled =
    state.game.phase === "ASSIGN_ROLES" &&
    state.game.roleConfirmations.confirmed < state.game.roleConfirmations.total;
  const confirmDisabled =
    !state.votes.myTargetPlayerId || state.votes.confirmedByMe;
  const nightConfirmDisabled =
    !state.me?.pendingNightTargetId || state.night.confirmedByMe;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
      <div className="mx-auto max-w-xl rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-ink-muted">
            {t("host_paneli")}
          </p>
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs font-medium text-bad transition active:scale-[0.98]"
          >
            {t("oyinni_tugatish")}
          </button>
        </div>
        {primaryLabel ? (
          <div
            className={`grid gap-2 ${
              showRoleReminder
                ? "grid-cols-[minmax(0,1fr)_auto]"
                : "grid-cols-1"
            }`}
          >
            <button
              type="button"
              onClick={onAdvancePhase}
              disabled={primaryDisabled || primaryPending}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {primaryPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t("yuborilmoqda")}
                </span>
              ) : (
                t(primaryLabel)
              )}
            </button>
            {showRoleReminder ? (
              <button
                type="button"
                onClick={onOpenRole}
                className="flex h-12 min-w-[132px] items-center justify-center rounded-2xl border border-line-strong bg-bg-base px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
              >
                {t("mening_kartam")}
              </button>
            ) : null}
          </div>
        ) : null}
        {!primaryLabel &&
        (showVoteConfirmAction ||
          showNightSelectionStatus ||
          showRoleReminder) ? (
          <div
            className={`mt-2 grid gap-2 ${
              (showVoteConfirmAction || showNightSelectionStatus) &&
              showRoleReminder
                ? "grid-cols-[minmax(0,1fr)_auto]"
                : "grid-cols-1"
            }`}
          >
            {showVoteConfirmAction ? (
              <button
                type="button"
                onClick={onConfirmVote}
                disabled={confirmDisabled || confirmVotePending}
                className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {confirmVotePending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {t("yuborilmoqda")}
                  </span>
                ) : state.votes.confirmedByMe ? (
                  t("tasdiqlandi")
                ) : (
                  t("ovozni_tasdiqlash")
                )}
              </button>
            ) : showNightSelectionStatus ? (
              <button
                type="button"
                onClick={onConfirmNight}
                disabled={nightConfirmDisabled || confirmNightPending}
                className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {confirmNightPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {t("yuborilmoqda")}
                  </span>
                ) : state.night.confirmedByMe ? (
                  t("tasdiqlandi")
                ) : state.me?.pendingNightTargetId ? (
                  t("tungi_qarorni_tasdiqlash")
                ) : (
                  t("nishonni_tanlang")
                )}
              </button>
            ) : null}
            {showRoleReminder ? (
              <button
                type="button"
                onClick={onOpenRole}
                className={`flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-bg-base px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98] ${
                  showVoteConfirmAction || showNightSelectionStatus
                    ? "min-w-[132px]"
                    : "w-full"
                }`}
              >
                {t("mening_kartam")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MafiaPlayerDock({
  state,
  showRoleReminder,
  showVoteConfirmAction,
  showNightSelectionStatus,
  confirmVotePending,
  confirmNightPending,
  onOpenRole,
  onConfirmVote,
  onConfirmNight,
}: {
  state: MafiaPublicState;
  showRoleReminder: boolean;
  showVoteConfirmAction: boolean;
  showNightSelectionStatus: boolean;
  confirmVotePending: boolean;
  confirmNightPending: boolean;
  onOpenRole: () => void;
  onConfirmVote: () => void;
  onConfirmNight: () => void;
}) {
  const { t } = useI18n();
  const me = state.me;
  if (!me || me.isHost || !showRoleReminder) return null;

  const confirmDisabled =
    !state.votes.myTargetPlayerId || state.votes.confirmedByMe;
  const nightConfirmDisabled =
    !state.me?.pendingNightTargetId || state.night.confirmedByMe;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
      <div
        className={`mx-auto grid max-w-xl gap-2 ${
          showVoteConfirmAction || showNightSelectionStatus
            ? "grid-cols-[minmax(0,1fr)_auto]"
            : "grid-cols-1"
        }`}
      >
        {showVoteConfirmAction ? (
          <button
            type="button"
            onClick={onConfirmVote}
            disabled={confirmDisabled || confirmVotePending}
            className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
          >
            {confirmVotePending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                {t("yuborilmoqda")}
              </span>
            ) : state.votes.confirmedByMe ? (
              t("tasdiqlandi")
            ) : (
              t("ovozni_tasdiqlash")
            )}
          </button>
        ) : showNightSelectionStatus ? (
          <button
            type="button"
            onClick={onConfirmNight}
            disabled={nightConfirmDisabled || confirmNightPending}
            className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
          >
            {confirmNightPending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                {t("yuborilmoqda")}
              </span>
            ) : state.night.confirmedByMe ? (
              t("tasdiqlandi")
            ) : state.me?.pendingNightTargetId ? (
              t("tungi_qarorni_tasdiqlash")
            ) : (
              t("nishonni_tanlang")
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenRole}
          className={`flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary shadow-pop transition active:scale-[0.98] ${
            showVoteConfirmAction || showNightSelectionStatus
              ? "min-w-[132px]"
              : "w-full"
          }`}
        >
          {t("mening_kartam")}
        </button>
      </div>
    </div>
  );
}

function getMafiaHostPrimaryLabel(
  state: MafiaPublicState | null,
): string | null {
  if (!state?.me?.isHost || state.room.status !== "PLAYING") return null;
  switch (state.game.phase) {
    case "ASSIGN_ROLES":
      return "tunni_boshlash";
    case "NIGHT_RESULT":
      return "kunni_boshlash";
    case "DAY_DISCUSSION":
      return "ovoz_berishni_boshlash";
    case "DAY_RESULT":
      return "keyingi_tunni_boshlash";
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Lobby view
// ─────────────────────────────────────────────────────────────────────

function Lobby({
  room,
  game,
  players,
  me,
  socketConnected,
  startGamePending,
  onStartGame,
  onLeaveRoom,
  onRequestKickPlayer,
  onRequestEndGame,
}: {
  room: MafiaPublicState["room"];
  game: MafiaPublicState["game"];
  players: MafiaPublicState["players"];
  me: MafiaPublicState["me"];
  socketConnected: boolean;
  startGamePending: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onRequestKickPlayer: (player: { id: string; name: string }) => void;
  onRequestEndGame: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const config = game.config;
  const specialRoles =
    config.mafiaCount +
    (config.hasSheriff ? 1 : 0) +
    (config.hasDoctor ? 1 : 0);
  const minPlayers = specialRoles + 1;
  const canStart = players.length >= minPlayers;
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${room.code}`
      : "";

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary pb-32">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <button
            type="button"
            onClick={() => router.push("/dashboard" as Route)}
            className="flex items-center gap-1 text-sm font-medium text-ink-secondary"
          >
            ← {t("bosh_sahifa")}
          </button>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 text-xs">
            {t("lobby")}
          </span>
        </header>

        {/* Room code card */}
        <section className="mt-2 rounded-3xl border border-line-subtle bg-bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("room_code")}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em]">
            {room.code}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            {t("players_maxplayers_oyinchi", {
              players: players.length,
              maxPlayers: room.maxPlayers,
            })}
          </p>

          <LobbyShareActions
            roomCode={room.code}
            inviteUrl={inviteUrl}
            gameLabel="Mafia"
          />
        </section>

        {/* Composition preview */}
        <section className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t("tarkib")}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <CompositionChip label="Mafia" value={config.mafiaCount} />
            <CompositionChip
              label={t("komisar_2")}
              value={config.hasSheriff ? 1 : 0}
            />
            <CompositionChip
              label={t("doktor_2")}
              value={config.hasDoctor ? 1 : 0}
            />
            <CompositionChip
              label={t("aholi")}
              value={Math.max(0, room.maxPlayers - specialRoles)}
            />
          </div>
        </section>

        {/* Players list */}
        <section className="mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{t("oyinchilar")}</h2>
            <p className="text-xs text-ink-muted">
              {t("kamida_minplayers_kishi_readycount_ta_6b25", {
                minPlayers,
                readyCount: Math.min(players.length, minPlayers),
              })}
            </p>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand">
                  {p.name.slice(0, 2)}
                </span>
                <div className="flex-1 leading-tight">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-ink-muted">
                    {me?.id === p.id
                      ? t("siz_2")
                      : p.online
                        ? t("oyinchi_2")
                        : t("tarmoqda_emas")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    p.online
                      ? "bg-ok/15 text-ok"
                      : "bg-bg-elevated text-ink-muted"
                  }`}
                >
                  ● {p.online ? t("onlayn") : t("offlayn")}
                </span>
                {me?.isHost && p.id !== me.id && room.status === "LOBBY" ? (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestKickPlayer({ id: p.id, name: p.name })
                    }
                    aria-label={t("name_ni_chiqarish", { name: p.name })}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bad/40 bg-bad/10 text-bad transition active:scale-95"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {!me?.isHost ? (
          <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-center text-sm text-ink-secondary">
            {t("host_oyinni_boshlashini_kuting_2")}
          </p>
        ) : null}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto max-w-xl">
          {me?.isHost ? (
            <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
              <p className="mb-2 text-xs font-medium text-ink-muted">
                {t("host_paneli")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onStartGame}
                  disabled={!canStart || startGamePending}
                  className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
                >
                  {startGamePending ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      {t("yuborilmoqda")}
                    </span>
                  ) : canStart ? (
                    t("oyinni_boshlash")
                  ) : (
                    t("count_ta_oyinchi_kerak", { count: minPlayers })
                  )}
                </button>
                <button
                  type="button"
                  onClick={onRequestEndGame}
                  className="flex h-12 items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition"
                >
                  {t("roomni_ochirish")}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad"
              >
                {t("roomdan_chiqish")}
              </button>
            </div>
          )}
        </div>
      </div>

      {!socketConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            {t("qayta_ulanmoqda")}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function CompositionChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line-strong bg-bg-base px-3 py-2">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono font-semibold text-ink-primary">{value}</span>
    </div>
  );
}

function ReconnectingBanner() {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
        {t("qayta_ulanmoqda")}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80"
    />
  );
}
