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
};

export function OnlineChat({
  meId,
  messages,
  onSend,
  bottomOffsetPx = 16,
  highlightedPlayerId = null,
  floating = true,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSeenMessageIdRef = useRef<string | null>(
    messages.at(-1)?.id ?? null,
  );

  const latestMessage = messages.at(-1) ?? null;
  const compactLabel = useMemo(() => {
    if (!latestMessage) return t("chatni_ochish");
    return `${latestMessage.senderName}: ${latestMessage.text}`;
  }, [latestMessage, t]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.replace(/\s+/g, " ").trim();
    if (!text) return;
    onSend(text);
    setDraft("");
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
      }`}
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

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-bg-overlay backdrop-blur-sm m-auto max-w-2xl"
        >
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-line-subtle bg-bg-surface">
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
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4"
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
                    <article
                      key={message.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        isMe
                          ? "border-brand/30 bg-brand-soft"
                          : isHighlighted
                            ? "border-warn/40 bg-warn/10"
                            : "border-line-subtle bg-bg-base"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink-primary">
                          {message.senderName}
                          {isMe ? ` · ${t("siz_2")}` : ""}
                        </p>
                        <time className="shrink-0 text-[11px] text-ink-muted">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-ink-primary">
                        {message.text}
                      </p>
                    </article>
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
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={300}
                  rows={1}
                  placeholder={t("chat_xabar_placeholder")}
                  className="min-h-[52px] flex-1 resize-none rounded-2xl border border-line-strong bg-bg-base px-4 py-3 text-sm text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
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
