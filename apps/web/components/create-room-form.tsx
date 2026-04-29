"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { getOrCreateSessionId } from "@/lib/storage";

type CreateRoomResponse = {
  roomCode: string;
};

type CreateRoomFormProps = {
  onOpenJoin: () => void;
};

const winnerOptions = [
  { value: 1, label: "1 kishi", hint: "Klassik" },
  { value: 2, label: "2 kishi", hint: "Tezroq" },
  { value: 3, label: "3 kishi", hint: "Yumshoq" }
];

export function CreateRoomForm({ onOpenJoin }: CreateRoomFormProps) {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const cached = getAuthUser();
    const fallback =
      cached?.nickname ??
      cached?.firstName ??
      cached?.telegramUsername ??
      "";
    if (fallback) setHostName((current) => current || fallback);
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const response = await apiRequest<CreateRoomResponse>(
        "/api/rooms/create",
        {
          method: "POST",
          body: JSON.stringify({
            hostName,
            sessionId,
            winnerTarget
          })
        }
      );

      router.push(`/room/${response.roomCode}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="grid gap-5">
      <Field label="Nickname">
        <input
          value={hostName}
          onChange={(event) => setHostName(event.target.value)}
          required
          maxLength={20}
          autoComplete="given-name"
          className="h-14 w-full rounded-2xl border border-line-strong bg-bg-surface px-4 text-base text-ink-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-ring"
          placeholder="Masalan, Alisher"
        />
      </Field>

      <Field label="O‘yin nechta odam qolganda tugaydi?">
        <div className="grid grid-cols-3 gap-2">
          {winnerOptions.map((option) => {
            const active = winnerTarget === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setWinnerTarget(option.value)}
                aria-pressed={active}
                className={`flex h-16 flex-col items-center justify-center rounded-2xl border text-center transition active:scale-[0.98] ${
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-strong bg-bg-surface text-ink-secondary"
                }`}
              >
                <span className="text-base font-semibold">{option.label}</span>
                <span className="text-[11px] text-ink-muted">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {error ? (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 pt-2">
        <button
          disabled={createLoading || !hostName.trim()}
          className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
        >
          {createLoading ? "Yaratilmoqda..." : "Room yaratish"}
        </button>
        <button
          type="button"
          onClick={onOpenJoin}
          className="flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary"
        >
          Buning o‘rniga qo‘shilish
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}
