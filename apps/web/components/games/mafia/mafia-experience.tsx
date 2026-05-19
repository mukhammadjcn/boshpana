"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CancelledRoomModal } from "@/components/cancelled-room-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { LoadingState } from "@/components/loading-state";
import { RoomExpiredState } from "@/components/room-expired-state";
import { TelegramChrome } from "@/components/telegram-chrome";
import { apiRequest } from "@/lib/api";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import { pushToast } from "@/store/useToastStore";
import type { RoomVisibility } from "@/lib/types";
import {
  RealtimeConnectionFeedback,
  useRealtimeConnectionRecovery,
} from "../shared/realtime-connection-feedback";
import {
  JoinWithNicknameRoomState,
  KickedFromRoomState,
  LoginPromptRoomState,
  UnavailableRoomState,
} from "../shared/game-entry-states";
import { OnlineChat } from "../shared/online-chat";
import { OnlineGovernanceModal } from "../shared/online-governance-modal";
import { RoomLeaveButton } from "../shared/room-leave-button";
import { MafiaHostDock, MafiaPlayerDock } from "./mafia-docks";
import { MafiaLobby } from "./mafia-lobby";
import {
  MafiaPhaseIntroModal,
  MafiaRoleReminderModal,
  MafiaSelfEliminationModal,
} from "./mafia-overlays";

import { MafiaDay } from "./mafia-day";
import { MafiaFinished } from "./mafia-finished";
import { MafiaNight } from "./mafia-night";
import { MafiaNightResult } from "./mafia-night-result";
import { MafiaRoleReveal } from "./mafia-role-reveal";
import type { MafiaPublicState } from "./mafia-types";
import { useMafiaAudio } from "./use-mafia-audio";

type MafiaExperienceProps = {
  roomCode: string;
  view: "room" | "game";
  uiVariant?: "friends" | "online";
  visibility?: RoomVisibility;
};

const MAFIA_MODAL_TIMINGS_MS = {
  pendingAction: 4000,
  roleReminder: 2000,
  dayResultAutoShow: 5000,
  phaseIntro: {
    night: 9000,
    day: 9000,
    tiebreak: 6000,
  },
} as const;

// Stage 2: lobby UI is fully wired. The in-game phases (role-reveal,
// night, day discussion, day vote, finished) ship in following
// commits — for now we render a placeholder once room.status flips to
// PLAYING / FINISHED so the host's "Start" still has somewhere to
// land while the rest of the screens are built.
export function MafiaExperience({
  roomCode,
  view,
  uiVariant = "friends",
  visibility = "PRIVATE",
}: MafiaExperienceProps) {
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
  const [dismissedKickProposalId, setDismissedKickProposalId] = useState<
    string | null
  >(null);
  const [dismissedEndGameProposalId, setDismissedEndGameProposalId] = useState<
    string | null
  >(null);
  const [dismissedSkipToVoteProposalId, setDismissedSkipToVoteProposalId] =
    useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // Optimistically lock the composer the instant a dead player fires
  // their last words, so a fast double-tap can't slip a second message
  // through before the server broadcast (which also enforces it) lands.
  const [lastWordsSent, setLastWordsSent] = useState(false);
  // Other players currently typing in chat: playerId → { name, expiresAt }.
  // Fed by the ephemeral `chat:typing` socket ping, pruned on a 1s tick.
  const [typingPlayers, setTypingPlayers] = useState<
    Record<string, { name: string; expiresAt: number }>
  >({});
  const [showFinalResults, setShowFinalResults] = useState(false);
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

  const reconnectSocket = useCallback(() => {
    if (!sessionId) return;
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
      return;
    }
    // Socket is connected but we may have been silently dropped from the
    // room (server restart we auto-recovered from, a backgrounded webview
    // that froze our heartbeat). `join_room` is idempotent server-side and
    // also flips this session back to "online", so re-assert membership
    // before refetching instead of only pulling state.
    socket.emit("join_room", { roomCode, sessionId });
    refreshState();
  }, [refreshState, roomCode, sessionId]);

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
    }, MAFIA_MODAL_TIMINGS_MS.pendingAction);
    return () => window.clearTimeout(timer);
  }, [pendingAction]);

  // Lobby vaqtida host xonani tugatib yuborsa room CANCELLED bo'ladi
  // va o'yin umuman boshlanmaydi. Har bir ishtirokchiga "o'yin
  // yaratilmadi" modal bir marta chiqsin va bosh sahifaga
  // yo'naltirsin. Bunker bilan bir xil pattern.
  useEffect(() => {
    if (roomState?.room.status !== "CANCELLED") return;
    if (!roomState.me) return;

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

    // Re-assert room membership and (optionally) pull a fresh snapshot.
    // The server's `join_room` is idempotent: it joins the socket to the
    // room, cancels any pending offline timer and flips the session back
    // to "online". Safe to call on every (re)entry.
    const resync = (recover: boolean) => {
      setSocketConnected(true);
      socket.emit("join_room", { roomCode, sessionId });
      if (recover) {
        void apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
      }
    };

    const onConnect = () => {
      resync(isReconnect);
      isReconnect = true;
    };

    const onDisconnect = () => setSocketConnected(false);
    const onState = (s: MafiaPublicState) => {
      if (s.room.code !== normalizedRoomCode) return;
      setRoomState(s);
      setLoading(false);
    };
    const onErr = ({ message }: { message: string }) => {
      pushToast({ kind: "error", text: message });
      setError(message);
      setPendingAction(null);
    };
    const onTyping = ({
      playerId,
      name,
    }: {
      playerId?: string;
      name?: string;
    }) => {
      if (!playerId || !name) return;
      setTypingPlayers((prev) => ({
        ...prev,
        [playerId]: { name, expiresAt: Date.now() + 3500 },
      }));
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) {
        socket.connect();
      } else {
        // Returned from a backgrounded Telegram webview: the connection
        // looks alive but the server may have dropped us from the room
        // while the tab was frozen. Re-join, don't just refetch.
        resync(true);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onState);
    socket.on("action_error", onErr);
    socket.on("chat:typing", onTyping);
    document.addEventListener("visibilitychange", onVisibility);

    // One socket.io client is shared across the whole app. After finishing
    // a game and walking into the next room WITHOUT a full page reload the
    // singleton is still connected, so `connect()` is a no-op and the
    // `connect` event never fires again — meaning `join_room` for the new
    // room would never be sent and the server keeps us subscribed to (and
    // "online" in) the OLD room while the new lobby shows us offline until
    // a manual refresh. Detect the already-connected case and join now.
    if (socket.connected) {
      resync(true);
    } else {
      socket.connect();
    }
    connectedRef.current = true;

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onState);
      socket.off("action_error", onErr);
      socket.off("chat:typing", onTyping);
      document.removeEventListener("visibilitychange", onVisibility);
      connectedRef.current = false;
    };
  }, [normalizedRoomCode, roomCode, sessionId]);

  // The countdown's single source of truth: a local 1Hz tick computed
  // from the absolute `timerEndsAt` deadline. We deliberately ignore the
  // server's `timer_update` broadcasts for display — under jittery mobile
  // networks they arrive bunched/late and made the number stutter and
  // jump backwards. A deadline-derived tick is monotonic and stays smooth
  // even when broadcasts drop or the tab returns from background.
  const timerEndsAtIso = roomState?.game.timerEndsAt ?? null;
  useEffect(() => {
    if (!timerEndsAtIso) return;
    const endsAt = new Date(timerEndsAtIso).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      patchTimer(remaining);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timerEndsAtIso, patchTimer]);

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

  // The optimistic last-words lock only makes sense while this player is
  // dead in an active game. Clear it otherwise (a fresh game, lobby,
  // post-game review) so the composer reopens.
  const meAliveFlag = roomState?.me?.isAlive ?? true;
  const roomStatusFlag = roomState?.room.status ?? null;
  useEffect(() => {
    if (meAliveFlag || roomStatusFlag !== "PLAYING") {
      setLastWordsSent(false);
    }
  }, [meAliveFlag, roomStatusFlag]);

  // Expire stale "typing" entries. Only ticks while someone is typing,
  // then stops — no idle interval churn.
  const hasTypers = Object.keys(typingPlayers).length > 0;
  useEffect(() => {
    if (!hasTypers) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setTypingPlayers((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, v]) => v.expiresAt > now),
        );
        return Object.keys(next).length === Object.keys(prev).length
          ? prev
          : next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasTypers]);

  // The moment a player's message lands, drop their "typing" entry so
  // the indicator vanishes the instant the message appears instead of
  // lingering for the ~3.5s expiry window.
  const lastChatMsg = roomState?.chat.messages.at(-1) ?? null;
  const lastChatMsgId = lastChatMsg?.id ?? null;
  const lastChatSenderId = lastChatMsg?.senderId ?? null;
  useEffect(() => {
    if (!lastChatSenderId) return;
    setTypingPlayers((prev) => {
      if (!prev[lastChatSenderId]) return prev;
      const next = { ...prev };
      delete next[lastChatSenderId];
      return next;
    });
  }, [lastChatMsgId, lastChatSenderId]);

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
    }, MAFIA_MODAL_TIMINGS_MS.roleReminder);
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
      MAFIA_MODAL_TIMINGS_MS.phaseIntro[
        phase === "NIGHT"
          ? "night"
          : phase === "DAY_TIEBREAK"
            ? "tiebreak"
            : "day"
      ],
    );
    return () => window.clearTimeout(timer);
  }, [
    phase,
    roomState?.game.dayNumber,
    roomState?.game.nightNumber,
    roomState?.room.status,
  ]);

  useEffect(() => {
    if (
      roomState?.game.phase === "DAY_RESULT" &&
      roomState.game.winner &&
      roomState.room.status === "PLAYING"
    ) {
      if (showFinalResults) return;
      const timer = window.setTimeout(() => {
        setShowFinalResults(true);
      }, MAFIA_MODAL_TIMINGS_MS.dayResultAutoShow);
      return () => window.clearTimeout(timer);
    }
    setShowFinalResults(false);
  }, [
    roomState?.game.phase,
    roomState?.game.winner,
    roomState?.room.status,
    showFinalResults,
  ]);

  useMafiaAudio({
    votingActive,
    nightActive: phase === "NIGHT",
    selfEliminationAudioKey: eliminatedModalOpen
      ? selfEliminationModalKey
      : null,
  });

  // Hook must run before any early return so React sees a stable hook order
  // even on the first render when roomState is still loading.
  const activeGovernanceProposal = useMemo(() => {
    if (!roomState) return null;
    const { kickProposal, endGameProposal, skipToVoteProposal } =
      roomState.governance;
    if (kickProposal && kickProposal.id !== dismissedKickProposalId) {
      return kickProposal;
    }
    if (endGameProposal && endGameProposal.id !== dismissedEndGameProposalId) {
      return endGameProposal;
    }
    if (
      skipToVoteProposal &&
      skipToVoteProposal.id !== dismissedSkipToVoteProposalId
    ) {
      return skipToVoteProposal;
    }
    return null;
  }, [
    roomState,
    dismissedKickProposalId,
    dismissedEndGameProposalId,
    dismissedSkipToVoteProposalId,
  ]);

  const selfEliminationModal = (
    <MafiaSelfEliminationModal
      open={eliminatedModalOpen}
      onClose={() => setEliminatedModalOpen(false)}
    />
  );
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
  const showResultsAction =
    roomState?.room.status === "PLAYING" &&
    roomState?.game.phase === "DAY_RESULT" &&
    !!roomState?.game.winner;
  const isPending = (actionKey: string) => pendingAction === actionKey;

  const handleRequestSkipToVote = () => {
    emit("online:request_skip_to_vote");
  };

  const { browserOnline, showRecoveryModal, retryNow, reloadPage } =
    useRealtimeConnectionRecovery({
      enabled: !!sessionId,
      connected: socketConnected,
      onReconnect: reconnectSocket,
      onRefreshState: refreshState,
    });
  const connectionFeedback = (
    <RealtimeConnectionFeedback
      connected={socketConnected}
      browserOnline={browserOnline}
      showRecoveryModal={showRecoveryModal}
      onRetryNow={retryNow}
      onReloadPage={reloadPage}
      onGoHome={() => {
        isLeavingRef.current = true;
        emit("leave_room");
        router.push("/dashboard" as Route);
      }}
    />
  );
  const roleReminderModal = roomState ? (
    <MafiaRoleReminderModal
      visible={roleModalVisible}
      open={roleModalOpen}
      state={roomState}
      onClose={() => setRoleModalOpen(false)}
    />
  ) : null;
  const phaseIntroModal = (
    <MafiaPhaseIntroModal
      phaseIntro={phaseIntro}
      meIsTiebreakCandidate={meIsTiebreakCandidate}
      allAliveAreTied={allAliveAreTied}
      onClose={() => setPhaseIntro(null)}
    />
  );
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
  // Rendered in EVERY phase block (not just the lobby) — the in-game
  // header shows a leave button during PLAYING, and without this modal
  // present those taps did nothing, so a player in a started game could
  // not leave the room at all.
  const leaveConfirmModal = (
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
  );

  if (loading) {
    return (
      <main>
        <TelegramChrome backHref="/dashboard" />
        <LoadingState label={t("yuklanmoqda_2")} />
      </main>
    );
  }

  if (!roomState) {
    return <RoomExpiredState roomCode={roomCode} detail={error} />;
  }

  const { room, players, me, game } = roomState;
  // Collapse the sheet whenever the phase or day/night counter changes —
  // a vote opens, day breaks, night falls; the user needs to see the
  // new screen instead of an open chat covering it.
  const chatCloseSignal = `${game.phase}:${game.dayNumber}:${game.nightNumber}`;
  // Mafia: an eliminated player is silenced for the rest of the game,
  // but gets one farewell message the whole table can read. Show the
  // warning while that one message is still available, then lock the
  // composer (the server enforces this too — this is just UX).
  const meIsDeadInPlay =
    uiVariant === "online" && !!me && !me.isAlive && room.status === "PLAYING";
  const meUsedLastWords =
    !!me &&
    roomState.chat.messages.some(
      (m) => m.senderId === me.id && m.kind === "last_words",
    );
  const chatComposerDisabled =
    meIsDeadInPlay && (meUsedLastWords || lastWordsSent);
  const chatNoticeText = !meIsDeadInPlay
    ? null
    : chatComposerDisabled
      ? t("siz_chiqdingiz_chatga_yoza_olmaysiz")
      : t("songgi_sozingizni_yozing_keyin_yoza_olmaysiz");
  const handleChatSend = (text: string) => {
    if (chatComposerDisabled) return;
    if (meIsDeadInPlay) setLastWordsSent(true);
    emit("chat:send", { text });
  };
  const handleChatTyping = () => {
    if (!me) return;
    emit("chat:typing", { playerId: me.id, name: me.name });
  };
  const nowMs = Date.now();
  const chatTypingNames = Object.entries(typingPlayers)
    .filter(([pid, v]) => v.expiresAt > nowMs && pid !== me?.id)
    .map(([, v]) => v.name);
  const onlineChatFloating =
    uiVariant === "online" && me ? (
      <OnlineChat
        key="global-online-chat"
        meId={me.id}
        messages={roomState.chat.messages}
        onSend={handleChatSend}
        onTyping={handleChatTyping}
        typingNames={chatTypingNames}
        noticeText={chatNoticeText}
        composerDisabled={chatComposerDisabled}
        closeOnSignal={chatCloseSignal}
        bottomOffsetPx={
          room.status === "LOBBY" ||
          game.phase === "ASSIGN_ROLES" ||
          game.phase === "NIGHT_RESULT" ||
          ((game.phase === "DAY_DISCUSSION" || game.phase === "DAY_RESULT") &&
            room.status === "PLAYING")
            ? 110
            : 16
        }
      />
    ) : null;
  const onlineChatAction =
    uiVariant === "online" && me ? (
      <OnlineChat
        key="global-online-chat"
        meId={me.id}
        messages={roomState.chat.messages}
        onSend={handleChatSend}
        onTyping={handleChatTyping}
        typingNames={chatTypingNames}
        noticeText={chatNoticeText}
        composerDisabled={chatComposerDisabled}
        floating={false}
        closeOnSignal={chatCloseSignal}
      />
    ) : null;
  const onlineHeaderAction =
    me &&
    room.status === "PLAYING" &&
    (uiVariant === "online" || !me.isHost) ? (
      <RoomLeaveButton onClick={() => setLeaveConfirmOpen(true)} />
    ) : null;
  const onlineGovernanceModal =
    uiVariant === "online" && me && activeGovernanceProposal ? (
      <OnlineGovernanceModal
        proposal={activeGovernanceProposal}
        mePlayerId={me.id}
        onClose={() => {
          if (activeGovernanceProposal.kind === "KICK") {
            setDismissedKickProposalId(activeGovernanceProposal.id);
          } else if (activeGovernanceProposal.kind === "END_GAME") {
            setDismissedEndGameProposalId(activeGovernanceProposal.id);
          } else if (activeGovernanceProposal.kind === "SKIP_TO_VOTE") {
            setDismissedSkipToVoteProposalId(activeGovernanceProposal.id);
          }
        }}
        onApprove={(proposalId) => {
          if (activeGovernanceProposal.kind === "KICK") {
            setDismissedKickProposalId(proposalId);
            emit("online:vote_kick", { proposalId, approve: true });
          } else if (activeGovernanceProposal.kind === "END_GAME") {
            setDismissedEndGameProposalId(proposalId);
            emit("online:vote_end_game", { proposalId, approve: true });
          } else if (activeGovernanceProposal.kind === "SKIP_TO_VOTE") {
            setDismissedSkipToVoteProposalId(proposalId);
            emit("online:vote_skip_to_vote", { proposalId, approve: true });
          }
        }}
        onReject={(proposalId) => {
          if (activeGovernanceProposal.kind === "KICK") {
            setDismissedKickProposalId(proposalId);
            emit("online:vote_kick", { proposalId, approve: false });
          } else if (activeGovernanceProposal.kind === "END_GAME") {
            setDismissedEndGameProposalId(proposalId);
            emit("online:vote_end_game", { proposalId, approve: false });
          } else if (activeGovernanceProposal.kind === "SKIP_TO_VOTE") {
            setDismissedSkipToVoteProposalId(proposalId);
            emit("online:vote_skip_to_vote", { proposalId, approve: false });
          }
        }}
      />
    ) : null;

  // Visitor (link recipient) hasn't joined yet — surface the right
  // call-to-action depending on room status and auth state. Mirrors
  // Bunker's invite flow.
  if (!me) {
    if (kickedModalOpen) {
      return (
        <KickedFromRoomState
          onGoHome={() => router.push("/dashboard" as Route)}
        />
      );
    }

    if (room.status !== "LOBBY") {
      const finished =
        room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <UnavailableRoomState
          roomCode={roomCode}
          finished={finished}
          startedDescriptionKey="oyin_boshlanganidan_keyin_yangi_oyinchi_6d01"
          onGoHome={() => router.push("/dashboard" as Route)}
          backHref="/dashboard"
          prefixHash
          trackingClassName="tracking-[0.34em]"
        />
      );
    }

    if (!getAuthToken()) {
      const loginHref = `/login?redirect=${encodeURIComponent(`/room/${roomCode}`)}`;
      return (
        <LoginPromptRoomState
          roomCode={roomCode}
          pretitleKey="taklif_mafia"
          loginHref={loginHref}
          backHref="/dashboard"
          prefixHash
          trackingClassName="tracking-[0.34em]"
        />
      );
    }

    return (
      <JoinWithNicknameRoomState
        roomCode={roomCode}
        pretitleKey="taklif_mafia"
        joinName={joinName}
        error={error}
        onJoinNameChange={setJoinName}
        onSubmit={handleJoin}
        prefixHash
        trackingClassName="tracking-[0.34em]"
      />
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
        <MafiaLobby
          room={room}
          game={game}
          players={players}
          me={me}
          visibility={visibility}
          connectionFeedback={connectionFeedback}
          chatAction={uiVariant === "online" ? onlineChatAction : null}
          startGamePending={isPending("lobby:start_game")}
          readyPending={isPending("lobby:toggle_ready")}
          uiVariant={uiVariant}
          onStartGame={() => emitWithPending("lobby:start_game", "start_game")}
          onToggleReady={() =>
            emitWithPending("lobby:toggle_ready", "toggle_ready")
          }
          onLeaveRoom={() => {
            setLeaveConfirmOpen(true);
          }}
          onRequestKickPlayer={(player) => setKickTarget(player)}
          onRequestEndGame={() => setEndGameConfirmOpen(true)}
        />
        {onlineGovernanceModal}
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
              ? t(
                  uiVariant === "online"
                    ? "name_ni_chiqarish_2"
                    : "name_ni_chiqarish_2",
                  { name: kickTarget.name },
                )
              : ""
          }
          description={
            uiVariant === "online"
              ? t("name_ni_oyindan_chiqarishga_rozi_bolasizmi", {
                  name: kickTarget?.name ?? t("oyinchi_2"),
                })
              : t("bu_oyinchi_roomdan_chiqarib_yuboriladi_e248")
          }
          confirmLabel={
            uiVariant === "online"
              ? t("kick_uchun_ovoz_boshlash")
              : t("chiqarish")
          }
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            if (kickTarget) {
              emit(
                uiVariant === "online"
                  ? "online:request_kick_vote"
                  : "kick_player",
                { targetPlayerId: kickTarget.id },
              );
            }
            setKickTarget(null);
          }}
          onClose={() => setKickTarget(null)}
        />
        {leaveConfirmModal}
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
          headerAction={onlineHeaderAction}
          onConfirm={() =>
            emitWithPending("mafia:confirm_role", "mafia:confirm_role")
          }
        />
        <MafiaHostDock
          state={roomState}
          chatAction={uiVariant === "online" ? onlineChatAction : null}
          suppressPrimaryAction={uiVariant === "online"}
          showManagementHeader={uiVariant !== "online"}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          showResultsAction={false}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onViewResults={() => setShowFinalResults(true)}
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
          chatAction={uiVariant === "online" ? onlineChatAction : null}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          showResultsAction={false}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onViewResults={() => setShowFinalResults(true)}
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
        {onlineGovernanceModal}
        {selfEliminationModal}
        {phaseIntroModal}
        {connectionFeedback}
        {leaveConfirmModal}
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
          headerAction={onlineHeaderAction}
          onReportPlayer={
            uiVariant === "online" && me.isAlive
              ? (targetPlayerId) => {
                  const target = players.find(
                    (player) => player.id === targetPlayerId,
                  );
                  if (!target) return;
                  setKickTarget({ id: target.id, name: target.name });
                }
              : undefined
          }
          submitPending={isPending("mafia:submit_night_action")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onConfirmNight={() =>
            emitWithPending(
              "mafia:confirm_night_action",
              "mafia:confirm_night_action",
            )
          }
          onOpenRole={() => setRoleModalOpen(true)}
          onSubmit={(action, targetPlayerId) =>
            emitWithPending(
              "mafia:submit_night_action",
              "mafia:submit_night_action",
              { action, targetPlayerId },
            )
          }
        />
        {onlineChatFloating}
        {playingEndGameModal}
        {onlineGovernanceModal}
        {selfEliminationModal}
        {roleReminderModal}
        {phaseIntroModal}
        {connectionFeedback}
        {leaveConfirmModal}
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
        <MafiaNightResult state={roomState} headerAction={onlineHeaderAction} />
        <MafiaHostDock
          state={roomState}
          chatAction={uiVariant === "online" ? onlineChatAction : null}
          suppressPrimaryAction={uiVariant === "online"}
          showManagementHeader={uiVariant !== "online"}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          showResultsAction={false}
          primaryPending={isPending("mafia:advance_phase")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onViewResults={() => setShowFinalResults(true)}
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
        {onlineGovernanceModal}
        {selfEliminationModal}
        <MafiaPlayerDock
          state={roomState}
          chatAction={uiVariant === "online" ? onlineChatAction : null}
          showRoleReminder={showRoleReminder}
          showVoteConfirmAction={showVoteConfirmAction}
          showNightSelectionStatus={showNightSelectionStatus}
          showResultsAction={false}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          confirmNightPending={isPending("mafia:confirm_night_action")}
          onViewResults={() => setShowFinalResults(true)}
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
        {connectionFeedback}
        {leaveConfirmModal}
      </>
    );
  }

  if (
    room.status === "PLAYING" &&
    game.phase === "DAY_RESULT" &&
    game.winner &&
    showFinalResults
  ) {
    return (
      <>
        <TelegramChrome backHref="/dashboard" />
        <MafiaFinished state={roomState} />
        {connectionFeedback}
        {leaveConfirmModal}
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
          headerAction={onlineHeaderAction}
          onReportPlayer={
            uiVariant === "online" && me.isAlive
              ? (targetPlayerId) => {
                  const target = players.find(
                    (player) => player.id === targetPlayerId,
                  );
                  if (!target) return;
                  setKickTarget({ id: target.id, name: target.name });
                }
              : undefined
          }
          voteSubmitPending={isPending("mafia:submit_day_vote")}
          confirmVotePending={isPending("mafia:confirm_day_vote")}
          onConfirmVote={() =>
            emitWithPending("mafia:confirm_day_vote", "mafia:confirm_day_vote")
          }
          onOpenRole={() => setRoleModalOpen(true)}
          onSubmitVote={(targetPlayerId) =>
            emitWithPending("mafia:submit_day_vote", "mafia:submit_day_vote", {
              targetPlayerId,
            })
          }
          onRequestSkipToVote={
            uiVariant === "online" ? handleRequestSkipToVote : undefined
          }
        />
        {game.phase === "DAY_VOTE" || game.phase === "DAY_TIEBREAK" ? null : (
          <MafiaHostDock
            state={roomState}
            chatAction={uiVariant === "online" ? onlineChatAction : null}
            suppressPrimaryAction={uiVariant === "online"}
            showManagementHeader={uiVariant !== "online"}
            showRoleReminder={showRoleReminder}
            showVoteConfirmAction={showVoteConfirmAction}
            showNightSelectionStatus={showNightSelectionStatus}
            showResultsAction={showResultsAction}
            primaryPending={isPending("mafia:advance_phase")}
            confirmVotePending={isPending("mafia:confirm_day_vote")}
            confirmNightPending={isPending("mafia:confirm_night_action")}
            onViewResults={() => setShowFinalResults(true)}
            onAdvancePhase={() =>
              emitWithPending("mafia:advance_phase", "mafia:advance_phase")
            }
            onEndGame={() => setEndGameConfirmOpen(true)}
            onOpenRole={() => setRoleModalOpen(true)}
            onConfirmVote={() =>
              emitWithPending(
                "mafia:confirm_day_vote",
                "mafia:confirm_day_vote",
              )
            }
            onConfirmNight={() =>
              emitWithPending(
                "mafia:confirm_night_action",
                "mafia:confirm_night_action",
              )
            }
          />
        )}
        {playingEndGameModal}
        {onlineGovernanceModal}
        {selfEliminationModal}
        {game.phase === "DAY_VOTE" || game.phase === "DAY_TIEBREAK" ? null : (
          <MafiaPlayerDock
            state={roomState}
            chatAction={uiVariant === "online" ? onlineChatAction : null}
            showRoleReminder={showRoleReminder}
            showVoteConfirmAction={showVoteConfirmAction}
            showNightSelectionStatus={showNightSelectionStatus}
            showResultsAction={showResultsAction}
            confirmVotePending={isPending("mafia:confirm_day_vote")}
            confirmNightPending={isPending("mafia:confirm_night_action")}
            onViewResults={() => setShowFinalResults(true)}
            onOpenRole={() => setRoleModalOpen(true)}
            onConfirmVote={() =>
              emitWithPending(
                "mafia:confirm_day_vote",
                "mafia:confirm_day_vote",
              )
            }
            onConfirmNight={() =>
              emitWithPending(
                "mafia:confirm_night_action",
                "mafia:confirm_night_action",
              )
            }
          />
        )}
        {roleReminderModal}
        {phaseIntroModal}
        {connectionFeedback}
        {leaveConfirmModal}
      </>
    );
  }

  // Game over — winner banner + role reveal grid.
  if (room.status === "FINISHED") {
    return (
      <>
        <TelegramChrome backHref="/dashboard" />
        <MafiaFinished state={roomState} />
        {onlineGovernanceModal}
        {selfEliminationModal}
        <CancelledRoomModal
          open={cancelledModalOpen}
          onDismiss={() => {
            if (typeof window !== "undefined") {
              window.location.replace("/dashboard");
              return;
            }
            router.replace("/dashboard" as Route);
          }}
        />
        {connectionFeedback}
        {leaveConfirmModal}
      </>
    );
  }

  // Lobby cancelled (host nuked the lobby before start or timeout)
  if (room.status === "CANCELLED") {
    return (
      <>
        <TelegramChrome backHref="/dashboard" />
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          {/* Empty background while the modal is shown */}
        </div>
        <CancelledRoomModal
          open={cancelledModalOpen}
          onDismiss={() => {
            if (typeof window !== "undefined") {
              window.location.replace("/dashboard");
              return;
            }
            router.replace("/dashboard" as Route);
          }}
        />
        {connectionFeedback}
        {leaveConfirmModal}
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
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 text-xs text-ink-secondary">
                {room.code}
              </span>
              {onlineHeaderAction}
            </div>
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
      {onlineGovernanceModal}
      {selfEliminationModal}
      {connectionFeedback}
      {leaveConfirmModal}
    </>
  );
}
