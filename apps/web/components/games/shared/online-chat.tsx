"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";

export type OnlineChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
};

type Props = {
  meId: string;
  messages: OnlineChatMessage[];
  onSend: (text: string) => void;
  bottomOffsetPx?: number;
  highlightedPlayerId?: string | null;
  floating?: boolean;
  triggerClassName?: string;
  // When this value changes, the sheet auto-closes. Parent passes the
  // current game phase / round token so a phase change (vote opens,
  // next round starts, elimination revealed) collapses the chat and
  // surfaces whatever state update is now waiting on the screen.
  closeOnSignal?: string | number;
};

// Persistent state to keep chat open across remounts during a session
const chatStatePersistence: Record<string, boolean> = {};

// Hash the senderId into one of 12 evenly-spaced HSL hues (30° apart).
// Bucketing into discrete steps avoids the "two greens that look the
// same" problem you'd get from raw `hash % 360`, while still giving us
// enough slots that a typical 4–12 player room has no collisions. The
// color is a pure function of senderId so each player keeps the same
// color for the whole game (and across reconnects).
const SENDER_HUE_BUCKETS = 12;

function senderColor(senderId: string): string {
  let hash = 5381;
  for (let i = 0; i < senderId.length; i += 1) {
    hash = ((hash << 5) + hash + senderId.charCodeAt(i)) | 0;
  }
  const hue = (Math.abs(hash) % SENDER_HUE_BUCKETS) * (360 / SENDER_HUE_BUCKETS);
  return `hsl(${hue}, 72%, 66%)`;
}

export function OnlineChat({
  meId,
  messages,
  onSend,
  bottomOffsetPx = 16,
  highlightedPlayerId = null,
  floating = true,
  triggerClassName = "",
  closeOnSignal,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !!chatStatePersistence[meId]);
  const [draft, setDraft] = useState("");
  // `mounted` keeps the sheet in the tree for the closing animation,
  // separate from `open` which drives the open/closed visual state.
  // `entered` flips on the next frame after mount so the slide-up
  // transition has a starting frame to interpolate from.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);
  const SHEET_TRANSITION_MS = 220;

  useEffect(() => {
    chatStatePersistence[meId] = open;
  }, [open, meId]);

  // Drive mount/enter/exit around `open`. Opening: mount → next frame
  // → entered=true (CSS transitions in). Closing: entered=false → wait
  // for the transition to finish → unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setEntered(false);
    const id = window.setTimeout(() => setMounted(false), SHEET_TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  // Auto-close on parent-driven signal (e.g. game phase change). We
  // skip the very first render — the parent always supplies a value
  // on mount, and we don't want to slam the sheet shut just because
  // the chat re-mounted while the user was reading it.
  const closeSignalRef = useRef(closeOnSignal);
  useEffect(() => {
    if (closeSignalRef.current === closeOnSignal) return;
    closeSignalRef.current = closeOnSignal;
    setOpen(false);
  }, [closeOnSignal]);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportHeight = "var(--tg-viewport-height, 100vh)";
  const sheetMaxHeight = `min(82vh, ${viewportHeight})`;
  const lastSeenMessageIdRef = useRef<string | null>(
    messages.at(-1)?.id ?? null,
  );

  const latestMessage = messages.at(-1) ?? null;
  const compactLabel = useMemo(() => {
    if (!latestMessage) return t("chatni_ochish");
    return `${latestMessage.senderName}: ${latestMessage.text}`;
  }, [latestMessage, t]);

  // Smart-scroll for incoming messages: only pin to bottom when the
  // user is already there (within ~80px). If they've scrolled up to
  // read backlog, leave their position alone. The exception is when
  // the newest message was sent by the user themselves — they expect
  // to see their own send land at the bottom regardless of scroll
  // position.
  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    const latest = messages.at(-1);
    const isOwn = latest?.senderId === meId;
    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    if (isOwn || distanceFromBottom < 80) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, open, meId]);

  // When the user opens the sheet, always jump straight to the bottom.
  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [open]);

  useEffect(() => {
    resizeTextarea();
  }, [draft, open]);

  useEffect(() => {
    const latestId = latestMessage?.id ?? null;
    if (!latestId) return;
    if (open) {
      lastSeenMessageIdRef.current = latestId;
      setUnreadCount(0);
      return;
    }

    if (lastSeenMessageIdRef.current === latestId) return;

    const lastSeenIndex = messages.findIndex(
      (message) => message.id === lastSeenMessageIdRef.current,
    );
    setUnreadCount(
      lastSeenIndex === -1
        ? messages.length
        : messages.length - lastSeenIndex - 1,
    );
  }, [latestMessage?.id, messages, open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    // Reset the textarea height in place. We avoid `.focus()` here: in
    // Telegram WebApp the keyboard collapses the moment focus moves off
    // the textarea (e.g. when the Yuborish button is tapped), and a
    // re-focus on the next frame triggers a second viewport jump that
    // makes the bottom-sheet visibly bounce. The button's onMouseDown
    // already prevents focus theft, so the textarea keeps focus and the
    // keyboard never animates.
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.style.height = "auto";
    });
  }

  function resizeTextarea() {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    const styles = window.getComputedStyle(node);
    const lineHeight = parseFloat(styles.lineHeight || "0");
    const paddingTop = parseFloat(styles.paddingTop || "0");
    const paddingBottom = parseFloat(styles.paddingBottom || "0");
    const borderTop = parseFloat(styles.borderTopWidth || "0");
    const borderBottom = parseFloat(styles.borderBottomWidth || "0");
    const maxHeight =
      lineHeight * 3 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.min(node.scrollHeight, maxHeight);
    node.style.height = `${nextHeight}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function openChat() {
    if (latestMessage?.id) {
      lastSeenMessageIdRef.current = latestMessage.id;
    }
    setUnreadCount(0);
    setOpen(true);
  }

  const trigger = (
    <button
      type="button"
      onClick={openChat}
      aria-label={t("chatni_ochish")}
      className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left shadow-pop transition active:scale-[0.99] ${
        unreadCount > 0
          ? "border-brand/35 bg-brand-soft/60"
          : "border-line-strong bg-bg-surface"
      } ${triggerClassName}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-primary">
          {floating ? compactLabel : t("chatni_ochish")}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-bg-base px-2.5 py-1 text-xs font-semibold text-ink-secondary">
        {unreadCount > 0 ? unreadCount : messages.length}
      </span>
    </button>
  );

  return (
    <>
      {floating ? (
        <div
          className="fixed inset-x-0 z-40 px-4"
          style={{
            bottom: `calc(env(safe-area-inset-bottom) + ${bottomOffsetPx}px)`,
          }}
        >
          <div className="mx-auto max-w-xl">{trigger}</div>
        </div>
      ) : (
        trigger
      )}

      {mounted ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 flex flex-col justify-end m-auto max-w-2xl transition-[background-color,backdrop-filter] duration-200 ${
            entered ? "bg-bg-overlay backdrop-blur-sm" : "bg-transparent"
          }`}
        >
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div
            className={`relative z-10 flex flex-col rounded-t-3xl border-t border-line-subtle bg-bg-surface transition-transform duration-200 ease-out ${
              entered ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ maxHeight: sheetMaxHeight }}
          >
            <div className="px-5 pt-4 pb-3">
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-line-strong" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-brand">
                    {t("xabarlar_soni_count", { count: messages.length })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-line-strong bg-bg-base text-ink-primary"
                  aria-label={t("yopish")}
                >
                  ×
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4"
            >
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line-strong bg-bg-base px-4 py-6 text-center text-sm text-ink-muted">
                  {t("chat_hali_bosh")}
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.senderId === meId;
                  const isHighlighted =
                    highlightedPlayerId === message.senderId;
                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`relative max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm ${
                          isMe
                            ? "rounded-tr-sm border border-brand/20 bg-brand-soft text-ink-primary"
                            : isHighlighted
                              ? "rounded-tl-sm border border-warn/30 bg-warn/10 text-ink-primary"
                              : "rounded-tl-sm border border-line-subtle bg-bg-base text-ink-primary"
                        }`}
                      >
                        {!isMe && (
                          <p
                            className="mb-0.5 text-[11px] font-bold tracking-tight uppercase opacity-90"
                            style={{ color: senderColor(message.senderId) }}
                          >
                            {message.senderName}
                          </p>
                        )}
                        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-0.5">
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                            {message.text}
                          </p>
                          <time className="ml-auto block shrink-0 select-none text-[10px] font-medium opacity-50 tabular-nums">
                            {new Date(message.timestamp).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )}
                          </time>
                        </div>
                      </article>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-line-subtle bg-bg-surface px-5 pt-3 pb-safe"
            >
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onInput={resizeTextarea}
                  maxLength={300}
                  rows={1}
                  placeholder={t("chat_xabar_placeholder")}
                  className="min-h-[52px] flex-1 resize-none rounded-2xl border border-line-strong bg-bg-base px-4 py-3 text-base text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  // Prevent the button from stealing focus from the
                  // textarea on tap. In Telegram WebApp a focus change is
                  // what makes the soft keyboard collapse and the
                  // bottom-sheet bounce; preventing it here keeps the
                  // keyboard stable through the send round-trip. On
                  // touch devices the click still fires — we just block
                  // the synthesised mousedown that moves focus.
                  onMouseDown={(event) => event.preventDefault()}
                  className="flex h-[52px] shrink-0 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
                >
                  {t("yuborish")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
