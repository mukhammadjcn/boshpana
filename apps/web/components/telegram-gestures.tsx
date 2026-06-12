"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  isInsideTelegram,
  isTelegramMobilePlatform,
  tgHaptic,
} from "@/lib/telegram";

// Telegram mobil gesture'lari — bitta touch state-machine ichida ikkitasi:
//   1) tepadan pastga sursa → sahifani yangilash (pull-to-refresh)
//   2) chap chetdan o'ngga sursa → orqaga qaytish (edge-swipe-back)
// Telegram WebView native overscroll/swipe'ni o'chiradi, shuning uchun qo'lda
// yoziladi: kutubxonasiz, native touch event'lar + imperativ DOM (har
// touchmove'da React re-render bo'lmasligi uchun). Faqat mobil Telegram'da
// ishlaydi — oddiy browserda hech narsa qilmaydi.

// Pull-to-refresh
const PULL_TRIGGER = 64; // shu masofadan keyin refresh ishga tushadi
const PULL_MAX = 96; // maksimal cho'zilish (rubber-band)
const PULL_DAMP = 0.55; // qarshilik koeffitsienti

// Edge-swipe-back
const EDGE_ZONE = 24; // chap chetdan shu px ichida boshlansa — back nomzodi
const BACK_TRIGGER = 80; // shu masofadan keyin back ishga tushadi
const BACK_MAX = 120; // chip maksimal yo'l

const DECIDE_THRESHOLD = 8; // yo'nalishni aniqlash uchun minimal harakat

type Mode = "undecided" | "refresh" | "back" | "none";

/** Touch nuqtasi ostidagi eng yaqin vertikal scroll konteyner tepasidami? */
function isAtTop(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node instanceof HTMLElement) {
    const oy = getComputedStyle(node).overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node.scrollTop <= 0;
    }
    node = node.parentElement;
  }
  const root = document.scrollingElement || document.documentElement;
  return (root?.scrollTop ?? 0) <= 0;
}

export function TelegramGestures() {
  const router = useRouter();

  useEffect(() => {
    if (!isInsideTelegram() || !isTelegramMobilePlatform()) {
      return;
    }

    // --- Vizual elementlar (imperativ — har touchmove'da React re-render
    // qilmaslik uchun). Karta app temasiga mos: to'q sirt + amber yoy/strelka.
    const spinner = document.createElement("div");
    spinner.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:var(--tg-safe-top,0px)",
      "z-index:60",
      "pointer-events:none",
      "opacity:0",
      "transform:translate(-50%,-40px)",
      "will-change:transform,opacity",
    ].join(";");
    spinner.innerHTML = `
      <div class="bp-ptr-ring" style="width:34px;height:34px;border-radius:50%;
        background:#1c2029;border:1px solid #262a33;
        box-shadow:0 6px 18px rgba(0,0,0,.45);
        display:flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a9 9 0 1 0 9 9" stroke="#ffb84d" stroke-width="2.6"
            stroke-linecap="round"/>
        </svg>
      </div>`;

    const backChip = document.createElement("div");
    backChip.style.cssText = [
      "position:fixed",
      "left:0",
      "top:50%",
      "z-index:60",
      "pointer-events:none",
      "opacity:0",
      "transform:translate(-44px,-50%)",
      "will-change:transform,opacity",
    ].join(";");
    backChip.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:#1c2029;
        border:1px solid #262a33;box-shadow:0 6px 18px rgba(0,0,0,.45);
        display:flex;align-items:center;justify-content:center;margin-left:6px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="#ffb84d" stroke-width="2.6"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;

    const style = document.createElement("style");
    style.textContent =
      "@keyframes bp-ptr-spin{to{transform:rotate(360deg)}}" +
      ".bp-ptr-ring--spin{animation:bp-ptr-spin .7s linear infinite}";

    document.head.appendChild(style);
    document.body.appendChild(spinner);
    document.body.appendChild(backChip);

    const ring = spinner.querySelector(".bp-ptr-ring") as HTMLElement;

    // --- Gesture holati ---
    let startX = 0;
    let startY = 0;
    let mode: Mode = "none";
    let atTop = false;
    let atEdge = false;
    let pull = 0;
    let backDx = 0;
    let triggeredHaptic = false;
    let active = false;

    const resetSpinner = (animate: boolean) => {
      spinner.style.transition = animate
        ? "transform .25s ease, opacity .25s ease"
        : "none";
      spinner.style.opacity = "0";
      spinner.style.transform = "translate(-50%,-40px)";
      ring.classList.remove("bp-ptr-ring--spin");
    };

    const resetBackChip = (animate: boolean) => {
      backChip.style.transition = animate
        ? "transform .2s ease, opacity .2s ease"
        : "none";
      backChip.style.opacity = "0";
      backChip.style.transform = "translate(-44px,-50%)";
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        mode = "none";
        active = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      atEdge = startX <= EDGE_ZONE;
      atTop = isAtTop(e.target);
      mode = "undecided";
      pull = 0;
      backDx = 0;
      triggeredHaptic = false;
      active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (mode === "undecided") {
        if (Math.abs(dx) < DECIDE_THRESHOLD && Math.abs(dy) < DECIDE_THRESHOLD) {
          return;
        }
        if (atEdge && dx > 0 && dx > Math.abs(dy)) {
          mode = "back";
        } else if (atTop && dy > 0 && dy > Math.abs(dx)) {
          mode = "refresh";
        } else {
          mode = "none"; // oddiy scroll / boshqa gesture — aralashmaymiz
        }
      }

      if (mode === "refresh") {
        if (e.cancelable) e.preventDefault();
        pull = Math.min(dy * PULL_DAMP, PULL_MAX);
        const progress = Math.min(pull / PULL_TRIGGER, 1);
        spinner.style.transition = "none";
        spinner.style.opacity = String(Math.min(pull / 36, 1));
        spinner.style.transform = `translate(-50%,${pull - 40}px)`;
        ring.style.transform = `rotate(${pull * 4}deg)`;
        if (progress >= 1 && !triggeredHaptic) {
          triggeredHaptic = true;
          tgHaptic("light");
        } else if (progress < 1) {
          triggeredHaptic = false;
        }
      } else if (mode === "back") {
        if (e.cancelable) e.preventDefault();
        backDx = Math.min(dx, BACK_MAX);
        const progress = Math.min(backDx / BACK_TRIGGER, 1);
        backChip.style.transition = "none";
        backChip.style.opacity = String(progress);
        backChip.style.transform = `translate(${-44 + backDx * 0.55}px,-50%) scale(${
          0.9 + progress * 0.1
        })`;
        if (progress >= 1 && !triggeredHaptic) {
          triggeredHaptic = true;
          tgHaptic("light");
        } else if (progress < 1) {
          triggeredHaptic = false;
        }
      }
    };

    const onTouchEnd = () => {
      if (!active) return;
      active = false;

      if (mode === "refresh") {
        if (pull >= PULL_TRIGGER) {
          // Refreshing holati — spinner aylanadi, keyin sahifa yangilanadi.
          spinner.style.transition = "transform .2s ease, opacity .2s ease";
          spinner.style.opacity = "1";
          spinner.style.transform = `translate(-50%,${PULL_TRIGGER - 36}px)`;
          ring.style.transform = "";
          ring.classList.add("bp-ptr-ring--spin");
          tgHaptic("medium");
          window.setTimeout(() => window.location.reload(), 180);
        } else {
          resetSpinner(true);
        }
      } else if (mode === "back") {
        if (backDx >= BACK_TRIGGER) {
          resetBackChip(true);
          tgHaptic("medium");
          router.back();
        } else {
          resetBackChip(true);
        }
      }

      mode = "none";
    };

    const onTouchCancel = () => {
      active = false;
      mode = "none";
      resetSpinner(true);
      resetBackChip(true);
    };

    // touchmove — passive:false (preventDefault ishlashi uchun)
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      spinner.remove();
      backChip.remove();
      style.remove();
    };
  }, [router]);

  return null;
}
