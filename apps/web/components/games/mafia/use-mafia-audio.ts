"use client";

import { useCallback, useEffect, useRef } from "react";

type MafiaAudioInput = {
  votingActive: boolean;
  selfEliminationAudioKey: string | null;
};

const KILLED = "/audio/shared/killed.mp3";
const VOTING_AUDIO = "/audio/shared/voting.mp3";

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

export function useMafiaAudio({
  votingActive,
  selfEliminationAudioKey
}: MafiaAudioInput) {
  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const votingLoopRef = useRef<HTMLAudioElement | null>(null);
  const seenKillRef = useRef<Set<string>>(new Set());
  const preloadedRef = useRef<Set<string>>(new Set());
  const didPreloadRef = useRef(false);
  const votingActiveRef = useRef(votingActive);
  const interactionUnlockedRef = useRef(false);

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

  const stopLoop = useCallback(
    (target: React.MutableRefObject<HTMLAudioElement | null>) => {
      const audio = target.current as
        | (HTMLAudioElement & { _stopped?: boolean })
        | null;
      if (!audio) return;
      target.current = null;
      audio._stopped = true;
      try {
        audio.muted = true;
        audio.pause();
        audio.currentTime = 0;
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

  useEffect(() => {
    if (didPreloadRef.current || !shouldPreload()) return;
    didPreloadRef.current = true;
    [KILLED, VOTING_AUDIO].forEach(preload);
  }, [preload]);

  useEffect(() => {
    return () => {
      activeAudiosRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      activeAudiosRef.current = [];
      votingLoopRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tryPlay = () => {
      interactionUnlockedRef.current = true;
      window.setTimeout(() => {
        if (votingActiveRef.current && !votingLoopRef.current) {
          playLoop(VOTING_AUDIO, 0.8, votingLoopRef);
        }
      }, 0);
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
  }, [playLoop]);

  useEffect(() => {
    if (!votingActive) {
      stopLoop(votingLoopRef);
      return;
    }
    playLoop(VOTING_AUDIO, 0.8, votingLoopRef);
  }, [votingActive, playLoop, stopLoop]);

  useEffect(() => {
    if (!selfEliminationAudioKey) return;
    if (seenKillRef.current.has(selfEliminationAudioKey)) return;
    seenKillRef.current.add(selfEliminationAudioKey);
    playOnce(KILLED, 0.9);
  }, [selfEliminationAudioKey, playOnce]);
}
