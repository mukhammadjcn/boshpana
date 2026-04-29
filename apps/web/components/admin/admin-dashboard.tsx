"use client";

import { useEffect, useState } from "react";

type AdminSchemaResponse = {
  models: string[];
};

type AdminListResponse = {
  items: Array<Record<string, unknown>>;
};

export function AdminDashboard() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [createPayload, setCreatePayload] = useState("{\n  \n}");
  const [editPayload, setEditPayload] = useState("{\n  \n}");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchema() {
      const response = await fetch("/api/admin/schema", { cache: "no-store" });
      const data = (await response.json()) as AdminSchemaResponse;
      setModels(data.models);
      setSelectedModel((current) => current || data.models[0] || "");
    }

    void loadSchema();
  }, []);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    void loadItems(selectedModel);
  }, [selectedModel]);

  async function loadItems(model: string) {
    try {
      setError(null);
      const response = await fetch(`/api/admin/${model}`, { cache: "no-store" });
      const data = (await response.json()) as AdminListResponse;
      setItems(data.items);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function createItem() {
    try {
      setError(null);
      setMessage(null);
      await fetch(`/api/admin/${selectedModel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: createPayload
      }).then(assertOk);
      setMessage("Yangi yozuv qo'shildi.");
      await loadItems(selectedModel);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function updateItem() {
    if (!editingId) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      await fetch(`/api/admin/${selectedModel}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: editPayload
      }).then(assertOk);
      setMessage("Yozuv saqlandi.");
      await loadItems(selectedModel);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function deleteItem(id: string) {
    try {
      setError(null);
      setMessage(null);
      await fetch(`/api/admin/${selectedModel}/${id}`, {
        method: "DELETE"
      }).then(assertOk);
      setMessage("Yozuv o'chirildi.");
      await loadItems(selectedModel);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function startEditing(item: Record<string, unknown>) {
    setEditingId(String(item.id));
    const { id, ...rest } = item;
    setEditPayload(JSON.stringify(rest, null, 2));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tablelar</p>
        <div className="mt-4 grid gap-2">
          {models.map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-medium ${
                selectedModel === model
                  ? "bg-orange-500 text-slate-950"
                  : "bg-slate-950/40 text-slate-200"
              }`}
            >
              {model}
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-200/70">
                Admin panel
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{selectedModel}</h1>
            </div>
            <button
              onClick={() => void loadItems(selectedModel)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white"
            >
              Refresh
            </button>
          </div>

          {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">Yangi yozuv</h2>
            <textarea
              value={createPayload}
              onChange={(event) => setCreatePayload(event.target.value)}
              className="mt-4 min-h-[220px] w-full rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 font-mono text-sm text-slate-100 outline-none"
            />
            <button
              onClick={createItem}
              className="mt-4 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Qo‘shish
            </button>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">Tahrirlash</h2>
            <textarea
              value={editPayload}
              onChange={(event) => setEditPayload(event.target.value)}
              className="mt-4 min-h-[220px] w-full rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 font-mono text-sm text-slate-100 outline-none"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={updateItem}
                disabled={!editingId}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Saqlash
              </button>
              {editingId ? (
                <p className="self-center text-xs uppercase tracking-[0.2em] text-slate-400">
                  Tanlangan ID: {editingId}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={String(item.id ?? index)}
              className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {String(item.id ?? `${selectedModel}-${index}`)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(item)}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Edit
                  </button>
                  {item.id ? (
                    <button
                      onClick={() => void deleteItem(String(item.id))}
                      className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-[1.5rem] bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function assertOk(response: Response) {
  if (response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => ({ message: "Xatolik yuz berdi." }));
  throw new Error(payload.message ?? "Xatolik yuz berdi.");
}
