"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameAudioInput = {
  introOpen: boolean;
  situationOpen: boolean;
  situationKey: string | null;
  situationRound: number | null;
  votingActive: boolean;
  meRevealKey: string | null;
  meEliminationKey: string | null;
};

const GAME_START = "/audio/bunker/game-start.mp3";
const KILLED = "/audio/shared/killed.mp3";
const VOTING_AUDIO = "/audio/shared/voting.mp3";
const REVEAL_AUDIOS = [
  "/audio/bunker/reveals/reveal-2.mp3",
  "/audio/bunker/reveals/reveal-3.mp3",
  "/audio/bunker/reveals/reveal-4.mp3",
  "/audio/bunker/reveals/reveal-5.mp3",
  "/audio/bunker/reveals/reveal-6.mp3",
  "/audio/bunker/reveals/reveal-7.mp3"
];
// situation7 is reserved for the voting phase, so it's not in the per-round
// rotation pool below.
const SITUATION_AUDIOS = [
  "/audio/bunker/situations/situation-1.mp3",
  "/audio/bunker/situations/situation-2.mp3",
  "/audio/bunker/situations/situation-3.mp3",
  "/audio/bunker/situations/situation-4.mp3",
  "/audio/bunker/situations/situation-5.mp3",
  "/audio/bunker/situations/situation-6.mp3"
];

function shouldPreload() {
  if (typeof navigator === "undefined") return false;
  const c = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        saveData?: boolean;
      };
    }
  ).connection;
  if (!c) return true;
  if (c.saveData) return false;
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return false;
  if (typeof c.downlink === "number" && c.downlink < 1.5) return false;
  return true;
}

// Fisher-Yates shuffle, in-place. Returns the same array for chaining.
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deck-based pick: shuffle once, hand out items in order. When empty,
// reshuffle (avoiding a back-to-back repeat with the previous head).
// Guarantees every audio plays before any repeats — far more variety than
// independent Math.random() picks.
function pickFromDeck(deck: string[], pool: readonly string[]): string {
  if (deck.length === 0) {
    const last = deck.length === 0 ? null : deck[0];
    deck.push(...pool);
    shuffleInPlace(deck);
    if (last && deck[0] === last && deck.length > 1) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
  }
  return deck.shift()!;
}

export function useGameAudio({
  introOpen,
  situationOpen,
  situationKey,
  situationRound,
  votingActive,
  meRevealKey,
  meEliminationKey
}: GameAudioInput) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioEnabledRef = useRef(audioEnabled);

  const preloadedRef = useRef<Set<string>>(new Set());
  const didPreloadRef = useRef(false);
  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const introLoopRef = useRef<HTMLAudioElement | null>(null);
  const situationLoopRef = useRef<HTMLAudioElement | null>(null);
  const votingLoopRef = useRef<HTMLAudioElement | null>(null);
  const situationAudioMapRef = useRef<Map<string, string>>(new Map());
  const revealDeckRef = useRef<string[]>([]);
  const situationDeckRef = useRef<string[]>([]);
  const seenRevealRef = useRef<Set<string>>(new Set());
  const seenElimRef = useRef<Set<string>>(new Set());
  const interactionUnlockedRef = useRef(false);

  // Mirror inputs into refs so the gesture handler always reads the latest
  // value, never a stale closure (root cause of "audio keeps playing after
  // modal closes": a late pointerdown re-triggered playLoop using closure
  // state from before the modal was closed).
  const introOpenRef = useRef(introOpen);
  const situationOpenRef = useRef(situationOpen);
  const situationKeyRef = useRef(situationKey);
  const situationRoundRef = useRef(situationRound);
  const votingActiveRef = useRef(votingActive);
  useEffect(() => {
    introOpenRef.current = introOpen;
  }, [introOpen]);
  useEffect(() => {
    situationOpenRef.current = situationOpen;
  }, [situationOpen]);
  useEffect(() => {
    situationKeyRef.current = situationKey;
  }, [situationKey]);
  useEffect(() => {
    situationRoundRef.current = situationRound;
  }, [situationRound]);
  useEffect(() => {
    votingActiveRef.current = votingActive;
  }, [votingActive]);

  const preload = useCallback((src: string) => {
    if (preloadedRef.current.has(src)) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    audio.load();
    preloadedRef.current.add(src);
  }, []);

  const stopAll = useCallback(() => {
    activeAudiosRef.current.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    activeAudiosRef.current = [];
    introLoopRef.current = null;
    situationLoopRef.current = null;
    votingLoopRef.current = null;
  }, []);

  const stopLoop = useCallback(
    (target: React.MutableRefObject<HTMLAudioElement | null>) => {
      const audio = target.current as
        | (HTMLAudioElement & { _stopped?: boolean })
        | null;
      if (!audio) return;
      target.current = null;
      // Mark as stopped so any pending play().then() resolution can detect
      // it and bail out (race condition fix).
      audio._stopped = true;
      try {
        // muted is immediate and survives a late play() resolution.
        audio.muted = true;
        audio.pause();
        audio.currentTime = 0;
        // Force-abort any in-flight play() / pending load.
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // ignore
      }
      activeAudiosRef.current = activeAudiosRef.current.filter(
        (a) => a !== audio
      );
    },
    []
  );

  const playOnce = useCallback((src: string, volume = 0.9) => {
    if (!audioEnabledRef.current) return;
    const audio = new Audio(src);
    audio.volume = volume;
    activeAudiosRef.current.push(audio);
    const cleanup = () => {
      activeAudiosRef.current = activeAudiosRef.current.filter(
        (a) => a !== audio
      );
    };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("pause", cleanup);
    void audio.play().catch(cleanup);
  }, []);

  const playLoop = useCallback(
    (
      src: string,
      volume: number,
      target: React.MutableRefObject<HTMLAudioElement | null>
    ) => {
      if (!audioEnabledRef.current) return;
      const existing = target.current;
      if (existing && existing.src.includes(src) && !existing.paused) return;
      stopLoop(target);
      const audio = new Audio(src) as HTMLAudioElement & {
        _stopped?: boolean;
      };
      audio.loop = true;
      audio.volume = volume;
      target.current = audio;
      activeAudiosRef.current.push(audio);
      audio
        .play()
        .then(() => {
          // If stop was requested (or slot reassigned) while play() was
          // pending, mute + pause immediately so no sound escapes.
          if (audio._stopped || target.current !== audio) {
            audio.muted = true;
            try {
              audio.pause();
              audio.removeAttribute("src");
              audio.load();
            } catch {
              // ignore
            }
            activeAudiosRef.current = activeAudiosRef.current.filter(
              (a) => a !== audio
            );
          }
        })
        .catch(() => {
          if (target.current === audio) {
            target.current = null;
          }
          activeAudiosRef.current = activeAudiosRef.current.filter(
            (a) => a !== audio
          );
        });
    },
    [stopLoop]
  );

  // Per-round deterministic pick: every client maps a given roundNumber to
  // the same audio file, so listeners hear the same music together. Falls
  // back to the situationKey for the rare case where round info is missing.
  const getSituationSrc = useCallback((key: string) => {
    if (!SITUATION_AUDIOS.length) return null;
    const cached = situationAudioMapRef.current.get(key);
    if (cached) return cached;
    const round = situationRoundRef.current;
    let picked: string;
    if (typeof round === "number" && round > 0) {
      const idx = (round - 1) % SITUATION_AUDIOS.length;
      picked = SITUATION_AUDIOS[idx];
    } else {
      picked = pickFromDeck(situationDeckRef.current, SITUATION_AUDIOS);
    }
    situationAudioMapRef.current.set(key, picked);
    return picked;
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((c) => !c);
  }, []);

  // Preload
  useEffect(() => {
    if (didPreloadRef.current || !shouldPreload()) return;
    didPreloadRef.current = true;
    [
      GAME_START,
      KILLED,
      VOTING_AUDIO,
      ...REVEAL_AUDIOS,
      ...SITUATION_AUDIOS
    ].forEach(preload);
  }, [preload]);

  // Sync enabled ref + stop all on disable
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    if (!audioEnabled) stopAll();
  }, [audioEnabled, stopAll]);

  // Stop everything on unmount so orphaned loops don't survive route changes
  // (e.g. /room/CODE → /game/CODE when the game starts).
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  // Resume loops on user gesture (mobile autoplay policy).
  // Reads ALL conditions through refs so a late pointerdown after a modal
  // closes can never restart audio with stale closure state.
  useEffect(() => {
    if (!audioEnabled) return;
    const tryPlay = () => {
      interactionUnlockedRef.current = true;
      if (!audioEnabledRef.current) return;
      if (introOpenRef.current && !introLoopRef.current) {
        playLoop(GAME_START, 0.9, introLoopRef);
      }
      const skey = situationKeyRef.current;
      if (situationOpenRef.current && skey && !situationLoopRef.current) {
        const src = getSituationSrc(skey);
        if (src) playLoop(src, 0.8, situationLoopRef);
      }
      if (votingActiveRef.current && !votingLoopRef.current) {
        playLoop(VOTING_AUDIO, 0.8, votingLoopRef);
      }
    };
    const handleFirstInteraction = () => {
      if (interactionUnlockedRef.current) return;
      tryPlay();
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
    window.addEventListener("pointerdown", handleFirstInteraction, {
      passive: true
    });
    window.addEventListener("keydown", handleFirstInteraction);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [audioEnabled, playLoop, getSituationSrc]);

  // Intro loop
  useEffect(() => {
    if (!introOpen) {
      stopLoop(introLoopRef);
      return;
    }
    playLoop(GAME_START, 0.9, introLoopRef);
  }, [introOpen, audioEnabled, playLoop, stopLoop]);

  // Situation loop
  useEffect(() => {
    if (!situationOpen || !situationKey) {
      stopLoop(situationLoopRef);
      return;
    }
    const src = getSituationSrc(situationKey);
    if (src) playLoop(src, 0.8, situationLoopRef);
  }, [
    situationOpen,
    situationKey,
    audioEnabled,
    getSituationSrc,
    playLoop,
    stopLoop
  ]);

  // Voting loop — same track for everyone, plays for the duration of the
  // VOTING phase so users notice they need to vote.
  useEffect(() => {
    if (!votingActive) {
      stopLoop(votingLoopRef);
      return;
    }
    playLoop(VOTING_AUDIO, 0.8, votingLoopRef);
  }, [votingActive, audioEnabled, playLoop, stopLoop]);

  // My reveal sound
  useEffect(() => {
    if (!meRevealKey) return;
    if (seenRevealRef.current.has(meRevealKey)) return;
    seenRevealRef.current.add(meRevealKey);
    const src = REVEAL_AUDIOS.length
      ? pickFromDeck(revealDeckRef.current, REVEAL_AUDIOS)
      : null;
    if (src) playOnce(src, 0.9);
  }, [meRevealKey, playOnce]);

  // My elimination sound
  useEffect(() => {
    if (!meEliminationKey) return;
    if (seenElimRef.current.has(meEliminationKey)) return;
    seenElimRef.current.add(meEliminationKey);
    playOnce(KILLED, 0.9);
  }, [meEliminationKey, playOnce]);

  return { audioEnabled, toggleAudio };
}
