"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameAudioInput = {
  introOpen: boolean;
  situationOpen: boolean;
  situationKey: string | null;
  meRevealKey: string | null;
  meEliminationKey: string | null;
};

const GAME_START = "/gamestart.mp3";
const KILLED = "/killed.mp3";
const REVEAL_AUDIOS = [
  "/reveal1.mp3",
  "/reveal2.mp3",
  "/reveal3.mp3",
  "/reveal4.mp3",
  "/reveal5.mp3",
  "/reveal6.mp3"
];
const SITUATION_AUDIOS = [
  "/situation2.mp3",
  "/situation3.mp3",
  "/situation4.mp3",
  "/situation5.mp3",
  "/situation6.mp3",
  "/situation7.mp3"
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

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function useGameAudio({
  introOpen,
  situationOpen,
  situationKey,
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
  const situationAudioMapRef = useRef<Map<string, string>>(new Map());
  const seenRevealRef = useRef<Set<string>>(new Set());
  const seenElimRef = useRef<Set<string>>(new Set());

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
  }, []);

  const stopLoop = useCallback(
    (target: React.MutableRefObject<HTMLAudioElement | null>) => {
      const audio = target.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      activeAudiosRef.current = activeAudiosRef.current.filter(
        (a) => a !== audio
      );
      target.current = null;
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
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = volume;
      target.current = audio;
      activeAudiosRef.current.push(audio);
      void audio.play().catch(() => stopLoop(target));
    },
    [stopLoop]
  );

  const getSituationSrc = useCallback((key: string) => {
    const cached = situationAudioMapRef.current.get(key);
    if (cached) return cached;
    if (!SITUATION_AUDIOS.length) return null;
    const idx = hashString(key) % SITUATION_AUDIOS.length;
    const picked = SITUATION_AUDIOS[idx];
    if (picked) situationAudioMapRef.current.set(key, picked);
    return picked ?? null;
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((c) => !c);
  }, []);

  // Preload
  useEffect(() => {
    if (didPreloadRef.current || !shouldPreload()) return;
    didPreloadRef.current = true;
    [GAME_START, KILLED, ...REVEAL_AUDIOS, ...SITUATION_AUDIOS].forEach(
      preload
    );
  }, [preload]);

  // Sync enabled ref + stop all on disable
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    if (!audioEnabled) stopAll();
  }, [audioEnabled, stopAll]);

  // Resume loops on user gesture (mobile autoplay policy)
  useEffect(() => {
    if (!audioEnabled) return;
    const tryPlay = () => {
      if (!audioEnabledRef.current) return;
      if (introOpen) playLoop(GAME_START, 0.9, introLoopRef);
      if (situationOpen && situationKey) {
        const src = getSituationSrc(situationKey);
        if (src) playLoop(src, 0.8, situationLoopRef);
      }
    };
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    return () => {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [audioEnabled, introOpen, situationOpen, situationKey, playLoop, getSituationSrc]);

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

  // My reveal sound
  useEffect(() => {
    if (!meRevealKey) return;
    if (seenRevealRef.current.has(meRevealKey)) return;
    seenRevealRef.current.add(meRevealKey);
    const src = REVEAL_AUDIOS[Math.floor(Math.random() * REVEAL_AUDIOS.length)];
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
