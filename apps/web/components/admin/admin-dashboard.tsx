"use client";

import { useEffect, useMemo, useState } from "react";

type AdminSchemaResponse = {
  models: string[];
};

type AdminListResponse = {
  items: AdminItem[];
};

type AdminItem = Record<string, any>;

type FieldType = "text" | "textarea" | "select" | "number" | "checkbox";

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

type Column = {
  key: string;
  label: string;
  width?: string;
  render: (item: AdminItem) => string;
};

type ModelDefinition = {
  label: string;
  description: string;
  columns: Column[];
  searchKeys?: string[];
  createFields?: FieldConfig[];
  editFields?: FieldConfig[];
  allowDelete?: boolean;
};

type FormState = Record<string, string | number | boolean>;

const cardTypeOptions = [
  { label: "Kasb", value: "PROFESSION" },
  { label: "Sog‘liq", value: "HEALTH" },
  { label: "Xarakter", value: "CHARACTER" },
  { label: "Skill", value: "SKILL" },
  { label: "Bagaj", value: "BAGGAGE" },
  { label: "Fakt", value: "FACT" }
];

const difficultyOptions = [
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" }
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const modelDefinitions: Record<string, ModelDefinition> = {
  cards: {
    label: "Kartalar",
    description: "Kasb, sog‘liq, xarakter va boshqa o‘yin kartalari.",
    searchKeys: ["text", "type"],
    createFields: [
      { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
      { key: "text", label: "Matn", type: "textarea", required: true }
    ],
    editFields: [
      { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
      { key: "text", label: "Matn", type: "textarea", required: true }
    ],
    allowDelete: true,
    columns: [
      { key: "type", label: "Turi", width: "w-32", render: (i) => formatCardType(i.type) },
      { key: "text", label: "Matn", render: (i) => String(i.text ?? "") }
    ]
  },
  disasters: {
    label: "Falokatlar",
    description: "O‘yin boshidagi global disaster ssenariylari.",
    searchKeys: ["name", "description"],
    createFields: [
      { key: "name", label: "Nomi", type: "text", required: true },
      { key: "description", label: "Tavsif", type: "textarea", required: true }
    ],
    editFields: [
      { key: "name", label: "Nomi", type: "text", required: true },
      { key: "description", label: "Tavsif", type: "textarea", required: true }
    ],
    allowDelete: true,
    columns: [
      { key: "name", label: "Nomi", width: "w-48", render: (i) => String(i.name ?? "") },
      { key: "description", label: "Tavsif", render: (i) => String(i.description ?? "") }
    ]
  },
  situations: {
    label: "Situation’lar",
    description: "Round boshida chiqadigan vaziyat kartalari.",
    searchKeys: ["text", "difficulty"],
    createFields: [
      { key: "text", label: "Matn", type: "textarea", required: true },
      { key: "difficulty", label: "Daraja", type: "select", required: true, options: difficultyOptions }
    ],
    editFields: [
      { key: "text", label: "Matn", type: "textarea", required: true },
      { key: "difficulty", label: "Daraja", type: "select", required: true, options: difficultyOptions }
    ],
    allowDelete: true,
    columns: [
      { key: "difficulty", label: "Daraja", width: "w-24", render: (i) => String(i.difficulty ?? "") },
      { key: "text", label: "Matn", render: (i) => String(i.text ?? "") }
    ]
  },
  players: {
    label: "O‘yinchilar",
    description: "Room‘ga qo‘shilgan foydalanuvchilar ro‘yxati.",
    searchKeys: ["name", "roomId"],
    editFields: [
      { key: "name", label: "Nickname", type: "text", required: true },
      { key: "isHost", label: "Host", type: "checkbox" },
      { key: "isAlive", label: "Tirik", type: "checkbox" }
    ],
    columns: [
      { key: "name", label: "Nickname", width: "w-40", render: (i) => String(i.name ?? "") },
      { key: "roomId", label: "Room", width: "w-40", render: (i) => String(i.roomId ?? "") },
      { key: "isAlive", label: "Holat", width: "w-24", render: (i) => (i.isAlive ? "Tirik" : "Chiqqan") },
      { key: "isHost", label: "Roli", width: "w-24", render: (i) => (i.isHost ? "Host" : "Player") }
    ]
  },
  rooms: {
    label: "Room’lar",
    description: "Aktiv va tugagan xonalar holati.",
    searchKeys: ["code", "status"],
    columns: [
      { key: "code", label: "Code", width: "w-28", render: (i) => String(i.code ?? "") },
      { key: "status", label: "Status", width: "w-28", render: (i) => String(i.status ?? "") },
      {
        key: "playerCount",
        label: "Playerlar",
        width: "w-24",
        render: (i) => String(Array.isArray(i.players) ? i.players.length : 0)
      },
      { key: "winnerTarget", label: "Finish", width: "w-24", render: (i) => `${String(i.winnerTarget ?? "-")} kishi` },
      {
        key: "createdAt",
        label: "Yaratilgan",
        width: "w-40",
        render: (i) => formatDate(i.createdAt)
      }
    ]
  },
  games: {
    label: "O‘yinlar",
    description: "Game state va round jarayonlari.",
    searchKeys: ["phase"],
    columns: [
      { key: "phase", label: "Phase", width: "w-32", render: (i) => String(i.phase ?? "") },
      { key: "roundNumber", label: "Round", width: "w-20", render: (i) => String(i.roundNumber ?? 0) },
      { key: "disaster", label: "Falokat", width: "w-40", render: (i) => String(i.disaster?.name ?? "-") },
      { key: "situation", label: "Situation", render: (i) => String(i.currentSituation?.text ?? "-") }
    ]
  },
  playerAttributes: {
    label: "Player kartalari",
    description: "Har bir player‘ga tushgan atributlar.",
    columns: [
      { key: "player", label: "Player", width: "w-32", render: (i) => String(i.player?.name ?? "") },
      { key: "profession", label: "Kasb", width: "w-32", render: (i) => String(i.profession ?? "") },
      { key: "health", label: "Sog‘liq", width: "w-32", render: (i) => String(i.health ?? "") },
      { key: "character", label: "Xarakter", width: "w-32", render: (i) => String(i.character ?? "") },
      { key: "skill", label: "Skill", render: (i) => String(i.skill ?? "") }
    ]
  },
  votes: {
    label: "Ovozlar",
    description: "Round bo‘yicha berilgan ovozlar.",
    columns: [
      { key: "roundNumber", label: "Round", width: "w-20", render: (i) => String(i.roundNumber ?? 0) },
      { key: "voter", label: "Kim berdi", width: "w-40", render: (i) => String(i.voterPlayer?.name ?? "") },
      { key: "target", label: "Kimga", width: "w-40", render: (i) => String(i.targetPlayer?.name ?? "") },
      { key: "room", label: "Room", width: "w-28", render: (i) => String(i.room?.code ?? "") },
      {
        key: "createdAt",
        label: "Vaqt",
        width: "w-40",
        render: (i) => formatDate(i.createdAt)
      }
    ]
  }
};

export function AdminDashboard() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<FormState>({});

  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [editState, setEditState] = useState<FormState>({});

  const [confirmDelete, setConfirmDelete] = useState<AdminItem | null>(null);

  const definition = modelDefinitions[selectedModel];
  const createFields = definition?.createFields ?? [];
  const editFields = definition?.editFields ?? [];

  // Load model list
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/schema", { cache: "no-store" });
        const data = (await response.json()) as AdminSchemaResponse;
        setModels(data.models);
        setSelectedModel((current) => current || data.models[0] || "");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  // Reset state on model change
  useEffect(() => {
    if (!selectedModel) return;
    setError(null);
    setMessage(null);
    setSearch("");
    setPage(1);
    setEditingItem(null);
    setConfirmDelete(null);
    void loadItems(selectedModel);
  }, [selectedModel]);

  // Auto-clear message
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2500);
    return () => window.clearTimeout(t);
  }, [message]);

  async function loadItems(model: string) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/${model}`, { cache: "no-store" });
      const data = (await response.json()) as AdminListResponse;
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createItem() {
    if (!definition?.createFields?.length) return;
    try {
      setError(null);
      const res = await fetch(`/api/admin/${selectedModel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeState(createFields, createState))
      });
      await assertOk(res);
      setMessage("Yangi yozuv qo‘shildi.");
      setCreateOpen(false);
      setCreateState(buildInitialState(createFields));
      await loadItems(selectedModel);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function updateItem() {
    if (!editingItem || !definition?.editFields?.length) return;
    try {
      setError(null);
      const res = await fetch(`/api/admin/${selectedModel}/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeState(editFields, editState))
      });
      await assertOk(res);
      setMessage("Yozuv saqlandi.");
      setEditingItem(null);
      await loadItems(selectedModel);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteItem(item: AdminItem) {
    try {
      setError(null);
      const res = await fetch(`/api/admin/${selectedModel}/${item.id}`, {
        method: "DELETE"
      });
      await assertOk(res);
      setMessage("Yozuv o‘chirildi.");
      setConfirmDelete(null);
      await loadItems(selectedModel);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openCreate() {
    setCreateState(buildInitialState(createFields));
    setCreateOpen(true);
  }

  function openEdit(item: AdminItem) {
    if (!editFields.length || !item.id) return;
    setEditState(buildStateFromItem(editFields, item));
    setEditingItem(item);
  }

  // Filtering + pagination
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    const keys = definition?.searchKeys ?? [];
    return items.filter((item) => {
      if (keys.length) {
        return keys.some((k) =>
          String(item[k] ?? "").toLowerCase().includes(q)
        );
      }
      return Object.values(item).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, definition?.searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredItems, safePage, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, selectedModel]);

  return (
    <div className="grid gap-3">
      {/* Model tabs */}
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {models.map((model) => {
          const def = modelDefinitions[model];
          const active = selectedModel === model;
          return (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-brand bg-brand text-bg-base"
                  : "border-line-subtle bg-bg-surface text-ink-secondary hover:border-line-strong"
              }`}
            >
              {def?.label ?? model}
            </button>
          );
        })}
      </nav>

      {/* Header bar */}
      <div className="flex flex-col gap-2 rounded-xl border border-line-subtle bg-bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink-primary">
            {definition?.label ?? selectedModel}
            <span className="ml-2 text-xs font-normal text-ink-muted">
              {filteredItems.length} ta
            </span>
          </h2>
          {definition?.description ? (
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {definition.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="h-8 flex-1 rounded-lg border border-line-strong bg-bg-base px-3 text-xs text-ink-primary outline-none focus:border-brand sm:w-48 sm:flex-none"
          />
          <button
            onClick={() => void loadItems(selectedModel)}
            disabled={loading}
            className="h-8 rounded-lg border border-line-strong bg-bg-elevated px-2.5 text-xs font-medium text-ink-secondary disabled:opacity-50"
            title="Refresh"
          >
            {loading ? "..." : "↻"}
          </button>
          {createFields.length ? (
            <button
              onClick={openCreate}
              className="h-8 rounded-lg bg-brand px-3 text-xs font-semibold text-bg-base"
            >
              + Qo‘shish
            </button>
          ) : null}
        </div>
      </div>

      {/* Notifications */}
      {message ? (
        <p className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-1.5 text-xs text-ok">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-1.5 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line-subtle bg-bg-elevated/60">
                {definition?.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted ${col.width ?? ""}`}
                  >
                    {col.label}
                  </th>
                ))}
                {(editFields.length || definition?.allowDelete) && (
                  <th className="w-20 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {""}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      (definition?.columns.length ?? 0) +
                      (editFields.length || definition?.allowDelete ? 1 : 0)
                    }
                    className="px-3 py-8 text-center text-xs text-ink-muted"
                  >
                    {loading
                      ? "Yuklanmoqda..."
                      : search
                        ? "Hech narsa topilmadi."
                        : "Bo‘sh."}
                  </td>
                </tr>
              ) : (
                pageItems.map((item, index) => (
                  <tr
                    key={String(item.id ?? index)}
                    className="border-b border-line-subtle/50 last:border-0 hover:bg-bg-elevated/30"
                  >
                    {definition?.columns.map((col) => {
                      const value = col.render(item) || "—";
                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2 align-top text-ink-primary ${col.width ?? ""}`}
                        >
                          <div
                            className="line-clamp-2 leading-5"
                            title={value}
                          >
                            {value}
                          </div>
                        </td>
                      );
                    })}
                    {(editFields.length || definition?.allowDelete) && (
                      <td className="w-20 px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {editFields.length && item.id ? (
                            <button
                              onClick={() => openEdit(item)}
                              className="rounded-md border border-line-strong bg-bg-elevated px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
                            >
                              Edit
                            </button>
                          ) : null}
                          {definition?.allowDelete && item.id ? (
                            <button
                              onClick={() => setConfirmDelete(item)}
                              className="rounded-md border border-bad/30 bg-bad/10 px-2 py-1 text-[11px] font-medium text-bad"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle bg-bg-elevated/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-ink-muted">
            <span>Sahifada</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-7 rounded-md border border-line-strong bg-bg-base px-2 text-xs text-ink-primary outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              {filteredItems.length === 0
                ? "0"
                : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredItems.length)}`}
              {" / "}
              {filteredItems.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-7 rounded-md border border-line-strong bg-bg-base px-2 text-ink-secondary disabled:opacity-40"
            >
              ←
            </button>
            <span className="px-2 text-ink-secondary">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-7 rounded-md border border-line-strong bg-bg-base px-2 text-ink-secondary disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {createOpen ? (
        <FormModal
          title={`${definition?.label ?? selectedModel} — yangi`}
          onClose={() => setCreateOpen(false)}
          onSubmit={createItem}
          submitLabel="Qo‘shish"
        >
          {createFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={createState[field.key]}
              onChange={(value) =>
                setCreateState((c) => ({ ...c, [field.key]: value }))
              }
            />
          ))}
        </FormModal>
      ) : null}

      {/* Edit modal */}
      {editingItem ? (
        <FormModal
          title={`Tahrirlash`}
          subtitle={`ID: ${String(editingItem.id ?? "")}`}
          onClose={() => setEditingItem(null)}
          onSubmit={updateItem}
          submitLabel="Saqlash"
        >
          {editFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={editState[field.key]}
              onChange={(value) =>
                setEditState((c) => ({ ...c, [field.key]: value }))
              }
            />
          ))}
        </FormModal>
      ) : null}

      {/* Delete confirm */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay backdrop-blur-sm px-4">
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line-subtle bg-bg-surface p-5">
            <h3 className="text-sm font-semibold text-ink-primary">
              O‘chirish tasdiqlansinmi?
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              ID: {String(confirmDelete.id)}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-9 flex-1 rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium"
              >
                Bekor
              </button>
              <button
                onClick={() => void deleteItem(confirmDelete)}
                className="h-9 flex-1 rounded-lg bg-bad text-xs font-semibold text-white"
              >
                O‘chirish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormModal({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  children
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center sm:px-4">
      <div className="absolute inset-0" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t border-line-subtle bg-bg-surface p-4 pb-safe sm:rounded-2xl sm:border"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full border border-line-strong bg-bg-elevated text-xs"
          >
            ×
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium"
          >
            Bekor
          </button>
          <button
            type="submit"
            className="h-10 flex-1 rounded-lg bg-brand text-xs font-semibold text-bg-base"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange
}: {
  field: FieldConfig;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  const baseClass =
    "w-full rounded-lg border border-line-strong bg-bg-base px-3 py-2 text-xs text-ink-primary outline-none focus:border-brand";

  if (field.type === "textarea") {
    return (
      <label className="grid gap-1 text-xs">
        <span className="text-ink-muted">{field.label}</span>
        <textarea
          required={field.required}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} min-h-[96px] leading-5`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="grid gap-1 text-xs">
        <span className="text-ink-muted">{field.label}</span>
        <select
          required={field.required}
          value={String(value ?? field.options?.[0]?.value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center justify-between rounded-lg border border-line-strong bg-bg-base px-3 py-2 text-xs">
        <span className="text-ink-secondary">{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-xs">
      <span className="text-ink-muted">{field.label}</span>
      <input
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        value={String(value ?? "")}
        onChange={(e) =>
          onChange(field.type === "number" ? Number(e.target.value) : e.target.value)
        }
        className={baseClass}
      />
    </label>
  );
}

function buildInitialState(fields: FieldConfig[]) {
  return fields.reduce<FormState>((acc, field) => {
    if (field.type === "checkbox") acc[field.key] = false;
    else if (field.type === "number") acc[field.key] = 0;
    else if (field.type === "select") acc[field.key] = field.options?.[0]?.value ?? "";
    else acc[field.key] = "";
    return acc;
  }, {});
}

function buildStateFromItem(fields: FieldConfig[], item: AdminItem) {
  return fields.reduce<FormState>((acc, field) => {
    if (field.type === "checkbox") acc[field.key] = Boolean(item[field.key]);
    else if (field.type === "number") acc[field.key] = Number(item[field.key] ?? 0);
    else acc[field.key] = String(item[field.key] ?? "");
    return acc;
  }, {});
}

function serializeState(fields: FieldConfig[], state: FormState) {
  return fields.reduce<Record<string, string | number | boolean>>(
    (acc, field) => {
      acc[field.key] = state[field.key];
      return acc;
    },
    {}
  );
}

function formatCardType(type: unknown) {
  switch (type) {
    case "PROFESSION":
      return "Kasb";
    case "HEALTH":
      return "Sog‘liq";
    case "CHARACTER":
      return "Xarakter";
    case "SKILL":
      return "Skill";
    case "BAGGAGE":
      return "Bagaj";
    case "FACT":
      return "Fakt";
    default:
      return String(type ?? "");
  }
}

function formatDate(value: unknown) {
  if (!value) return "—";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("uz-UZ", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

async function assertOk(response: Response) {
  if (response.ok) return response;
  const payload = await response.json().catch(() => ({ message: "Xatolik yuz berdi." }));
  throw new Error(payload.message ?? "Xatolik yuz berdi.");
}
