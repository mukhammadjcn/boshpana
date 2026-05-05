"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const STATS_TAB = "__stats__";


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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];


function buildCardTypeOptions() {
  return [
    { label: "Kasb", value: "PROFESSION" },
    { label: "Sog'liq", value: "HEALTH" },
    { label: "Xarakter", value: "CHARACTER" },
    { label: "Skill", value: "SKILL" },
    { label: "Bagaj", value: "BAGGAGE" },
    { label: "Fakt", value: "FACT" }
  ];
}

function buildDifficultyOptions() {
  return [
    { label: "Oson", value: "EASY" },
    { label: "O'rta", value: "MEDIUM" },
    { label: "Qiyin", value: "HARD" }
  ];
}

const cardTypeOptions = buildCardTypeOptions();
const difficultyOptions = buildDifficultyOptions();

function buildModelDefinitions(): Record<string, ModelDefinition> {
  return {
    cards: {
      label: "Kartalar",
      description: "Bunker o'yinidagi barcha kartalar",
      searchKeys: ["text", "type"],
      createFields: [
        { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
        { key: "text", label: "Matn", type: "textarea", required: true },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      editFields: [
        { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
        { key: "text", label: "Matn", type: "textarea", required: true },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      allowDelete: true,
      columns: [
        { key: "type", label: "Turi", width: "w-32", render: (i) => formatCardType(i.type) },
        {
          key: "isAdult",
          label: "Reyting",
          width: "w-20",
          render: (i) => (i.isAdult ? "18+" : "Normal")
        },
        { key: "text", label: "Matn", render: (i) => String(i.text ?? "") }
      ]
    },
    disasters: {
      label: "Falokatlar",
      description: "Bunker o'yinidagi falokat stsenariylari",
      searchKeys: ["name", "description"],
      createFields: [
        { key: "name", label: "Nomi", type: "text", required: true },
        { key: "description", label: "Tavsif", type: "textarea", required: true },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      editFields: [
        { key: "name", label: "Nomi", type: "text", required: true },
        { key: "description", label: "Tavsif", type: "textarea", required: true },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      allowDelete: true,
      columns: [
        { key: "name", label: "Nomi", width: "w-48", render: (i) => String(i.name ?? "") },
        {
          key: "isAdult",
          label: "Reyting",
          width: "w-20",
          render: (i) => (i.isAdult ? "18+" : "Normal")
        },
        { key: "description", label: "Tavsif", render: (i) => String(i.description ?? "") }
      ]
    },
    situations: {
      label: "Vaziyatlar",
      description: "Bunker o'yinidagi vaziyat kartalari",
      searchKeys: ["text", "difficulty"],
      createFields: [
        { key: "text", label: "Matn", type: "textarea", required: true },
        { key: "difficulty", label: "Daraja", type: "select", required: true, options: difficultyOptions },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      editFields: [
        { key: "text", label: "Matn", type: "textarea", required: true },
        { key: "difficulty", label: "Daraja", type: "select", required: true, options: difficultyOptions },
        { key: "isAdult", label: "18+ kontent", type: "checkbox" }
      ],
      allowDelete: true,
      columns: [
        {
          key: "difficulty",
          label: "Daraja",
          width: "w-24",
          render: (i) => formatDifficulty(i.difficulty)
        },
        {
          key: "isAdult",
          label: "Reyting",
          width: "w-20",
          render: (i) => (i.isAdult ? "18+" : "Normal")
        },
        { key: "text", label: "Matn", render: (i) => String(i.text ?? "") }
      ]
    },
    users: {
      label: "Foydalanuvchilar",
      description: "Tizimga kirgan barcha foydalanuvchilar",
      searchKeys: ["telegramUsername", "firstName", "nickname", "phone"],
      columns: [
        {
          key: "user",
          label: "Foydalanuvchi",
          width: "w-56",
          render: (i) => {
            const fullName = [i.firstName, i.lastName].filter(Boolean).join(" ");
            return i.nickname || fullName || i.telegramUsername || i.telegramId || "—";
          }
        },
        {
          key: "telegramUsername",
          label: "Telegram",
          width: "w-40",
          render: (i) =>
            i.telegramUsername ? `@${i.telegramUsername}` : String(i.telegramId ?? "—")
        },
        {
          key: "phone",
          label: "Telefon",
          width: "w-36",
          render: (i) => String(i.phone ?? "—")
        },
        {
          key: "createdAt",
          label: "Ro'yxatdan o'tgan",
          width: "w-40",
          render: (i) => formatDate(i.createdAt)
        }
      ]
    },
    rooms: {
      label: "Roomlar",
      description: "Barcha yaratilgan o'yin xonalari",
      searchKeys: ["code", "status"],
      columns: [
        { key: "code", label: "Kod", width: "w-28", render: (i) => String(i.code ?? "") },
        { key: "status", label: "Status", width: "w-28", render: (i) => String(i.status ?? "") },
        {
          key: "playerCount",
          label: "O'yinchilar",
          width: "w-24",
          render: (i) => String(Array.isArray(i.players) ? i.players.length : 0)
        },
        {
          key: "winnerTarget",
          label: "Finish",
          width: "w-24",
          render: (i) => `${String(i.winnerTarget ?? "-")} kishi`
        },
        {
          key: "createdAt",
          label: "Yaratilgan",
          width: "w-40",
          render: (i) => formatDate(i.createdAt)
        }
      ]
    },
    gameHistory: {
      label: "O'yinlar tarixi",
      description: "Yakunlangan barcha o'yinlar",
      searchKeys: ["roomCode", "disasterName", "outcome"],
      columns: [
        {
          key: "playedAt",
          label: "Sana",
          width: "w-40",
          render: (i) => formatDate(i.playedAt)
        },
        {
          key: "user",
          label: "Host",
          width: "w-44",
          render: (i) => {
            const u = i.user as
              | {
                  nickname?: string;
                  firstName?: string;
                  lastName?: string;
                  telegramUsername?: string;
                }
              | undefined;
            if (!u) return "—";
            const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
            return u.nickname || fullName || u.telegramUsername || "—";
          }
        },
        {
          key: "roomCode",
          label: "Room",
          width: "w-24",
          render: (i) => String(i.roomCode ?? "—")
        },
        {
          key: "disasterName",
          label: "Falokat",
          width: "w-40",
          render: (i) => String(i.disasterName ?? "—")
        },
        {
          key: "playerCount",
          label: "O'yinchi",
          width: "w-20",
          render: (i) => String(i.playerCount ?? "—")
        },
        {
          key: "outcome",
          label: "Natija",
          width: "w-28",
          render: (i) => String(i.outcome ?? "—")
        },
        {
          key: "duration",
          label: "Davomiyligi",
          width: "w-28",
          render: (i) => {
            const s = Number(i.durationSeconds ?? 0);
            if (!s) return "—";
            const m = Math.round((s / 60) * 10) / 10;
            return `${m} daq`;
          }
        }
      ]
    }
  };
}

const modelDefinitions = buildModelDefinitions();

export function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Hydrate state from URL on first render so a refresh restores the same
  // tab + filters + pagination the user was looking at.
  const initialTab = searchParams.get("tab") || STATS_TAB;
  const initialPageSize = (() => {
    const raw = Number(searchParams.get("size") ?? 10);
    return PAGE_SIZE_OPTIONS.includes(raw) ? raw : 10;
  })();
  const initialAdult = (searchParams.get("adult") ?? "all") as
    | "all"
    | "normal"
    | "adult";

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(initialTab);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  // Cards-only quick filters: limit table by card type and/or 18+ flag.
  const [typeFilter, setTypeFilter] = useState<string>(
    searchParams.get("type") ?? ""
  );
  const [adultFilter, setAdultFilter] = useState<"all" | "normal" | "adult">(
    ["all", "normal", "adult"].includes(initialAdult) ? initialAdult : "all"
  );
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1) || 1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After the first render the URL becomes the source of truth. Switching
  // tabs goes through `selectTab()` which resets transient params; routine
  // state changes (search, page, filters) sync up via the effect below.
  // The ref guards against the very first sync so we don't push a redundant
  // "?tab=__stats__" to history when there were no params at all.
  const initialSyncDoneRef = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<FormState>({});
  const [creating, setCreating] = useState(false);

  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [editState, setEditState] = useState<FormState>({});
  const [updating, setUpdating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<AdminItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const definition = modelDefinitions[selectedModel];
  const createFields = definition?.createFields ?? [];
  const editFields = definition?.editFields ?? [];

  // Load model list. Default to STATS_TAB if the URL didn't already pick a
  // tab — never silently force the user off the tab they refreshed onto.
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/schema", { cache: "no-store" });
        const data = (await response.json()) as AdminSchemaResponse;
        setModels(data.models);
        setSelectedModel((current) => current || STATS_TAB);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  // Load items when the selected model changes. Stats tab is data-less.
  // We don't reset filter/page/search here — that's the job of selectTab(),
  // which fires only on USER-initiated tab changes. Refresh + URL hydration
  // need to preserve the existing params.
  useEffect(() => {
    if (!selectedModel) return;
    setError(null);
    setMessage(null);
    setEditingItem(null);
    setConfirmDelete(null);
    if (selectedModel === STATS_TAB) {
      setItems([]);
      return;
    }
    void loadItems(selectedModel);
  }, [selectedModel]);

  // Mirror state into the URL so a refresh keeps the same view. Each param
  // is only emitted when it diverges from the default to keep URLs clean.
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedModel && selectedModel !== STATS_TAB) {
      params.set("tab", selectedModel);
    }
    if (search) params.set("q", search);
    if (typeFilter) params.set("type", typeFilter);
    if (adultFilter !== "all") params.set("adult", adultFilter);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 10) params.set("size", String(pageSize));
    const query = params.toString();
    const next = (query ? `${pathname}?${query}` : pathname) as Route;
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      // Skip the very first sync — leaves the original URL alone if the
      // user landed on a clean /admin URL with no params.
      return;
    }
    router.replace(next, { scroll: false });
  }, [
    selectedModel,
    search,
    typeFilter,
    adultFilter,
    page,
    pageSize,
    pathname,
    router
  ]);

  // User-initiated tab switch: reset every transient param so the new tab
  // starts fresh. Refresh / back-button navigations don't go through here —
  // they hydrate state directly from the URL on first render.
  function selectTab(model: string) {
    if (model === selectedModel) return;
    setSelectedModel(model);
    setSearch("");
    setTypeFilter("");
    setAdultFilter("all");
    setPage(1);
    setPageSize(10);
  }

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
    if (!definition?.createFields?.length || creating) return;
    try {
      setCreating(true);
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
    } finally {
      setCreating(false);
    }
  }

  async function updateItem() {
    if (!editingItem || !definition?.editFields?.length || updating) return;
    try {
      setUpdating(true);
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
    } finally {
      setUpdating(false);
    }
  }

  async function deleteItem(item: AdminItem) {
    if (deleting) return;
    try {
      setDeleting(true);
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
    } finally {
      setDeleting(false);
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
    const q = search.trim().toLowerCase();
    const keys = definition?.searchKeys ?? [];
    return items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (adultFilter === "adult" && !item.isAdult) return false;
      if (adultFilter === "normal" && item.isAdult) return false;
      if (!q) return true;
      if (keys.length) {
        return keys.some((k) =>
          String(item[k] ?? "").toLowerCase().includes(q)
        );
      }
      return Object.values(item).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, adultFilter, definition?.searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredItems, safePage, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, selectedModel, typeFilter, adultFilter]);

  return (
    <div className="grid gap-3">
      {/* Model tabs */}
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        <button
          onClick={() => selectTab(STATS_TAB)}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            selectedModel === STATS_TAB
              ? "border-brand bg-brand text-bg-base"
              : "border-line-subtle bg-bg-surface text-ink-secondary hover:border-line-strong"
          }`}
        >
          Statistika
        </button>
        {models.map((model) => {
          const def = modelDefinitions[model];
          const active = selectedModel === model;
          return (
            <button
              key={model}
              onClick={() => selectTab(model)}
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

      {selectedModel === STATS_TAB ? <AdminStats /> : (<>

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
          {selectedModel === "cards" ? (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-line-strong bg-bg-base px-2 text-xs text-ink-primary outline-none focus:border-brand"
              title="Turi bo'yicha filter"
            >
              <option value="">Barcha turlar</option>
              {cardTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
          {selectedModel === "cards" ||
          selectedModel === "disasters" ||
          selectedModel === "situations" ? (
            <select
              value={adultFilter}
              onChange={(e) =>
                setAdultFilter(e.target.value as "all" | "normal" | "adult")
              }
              className="h-8 rounded-lg border border-line-strong bg-bg-base px-2 text-xs text-ink-primary outline-none focus:border-brand"
              title="Reyting bo'yicha filter"
            >
              <option value="all">Barcha reyting</option>
              <option value="normal">Normal</option>
              <option value="adult">18+</option>
            </select>
          ) : null}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="h-8 flex-1 rounded-lg border border-line-strong bg-bg-base px-3 text-xs text-ink-primary outline-none focus:border-brand sm:w-48 sm:flex-none"
          />
          <button
            onClick={() => void loadItems(selectedModel)}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium text-ink-secondary disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            {loading ? (
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden
              />
            ) : (
              "↻"
            )}
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
      <div className="relative overflow-hidden rounded-xl border border-line-subtle bg-bg-surface">
        {loading ? (
          <div className="absolute left-0 right-0 top-0 z-10 h-0.5 overflow-hidden bg-line-subtle">
            <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] bg-brand" />
          </div>
        ) : null}
        <div
          className={`overflow-x-auto transition-opacity ${loading && pageItems.length ? "opacity-60" : ""}`}
        >
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
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                          aria-hidden
                        />
                        Yuklanmoqda...
                      </span>
                    ) : search ? (
                      "Hech narsa topilmadi."
                    ) : (
                      "Bo‘sh."
                    )}
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
          onClose={() => !creating && setCreateOpen(false)}
          onSubmit={createItem}
          submitLabel="Qo‘shish"
          loading={creating}
        >
          {createFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={createState[field.key]}
              onChange={(value) =>
                setCreateState((c) => ({ ...c, [field.key]: value }))
              }
              disabled={creating}
            />
          ))}
        </FormModal>
      ) : null}

      {/* Edit modal */}
      {editingItem ? (
        <FormModal
          title={`Tahrirlash`}
          subtitle={`ID: ${String(editingItem.id ?? "")}`}
          onClose={() => !updating && setEditingItem(null)}
          onSubmit={updateItem}
          submitLabel="Saqlash"
          loading={updating}
        >
          {editFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={editState[field.key]}
              onChange={(value) =>
                setEditState((c) => ({ ...c, [field.key]: value }))
              }
              disabled={updating}
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
                onClick={() => !deleting && setConfirmDelete(null)}
                disabled={deleting}
                className="h-9 flex-1 rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium disabled:opacity-50"
              >
                Bekor
              </button>
              <button
                onClick={() => void deleteItem(confirmDelete)}
                disabled={deleting}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-bad text-xs font-semibold text-white disabled:opacity-60"
              >
                {deleting ? <Spinner /> : null}
                {deleting ? "O‘chirilmoqda..." : "O‘chirish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>)}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

type StatsResponse = {
  totalUsers: number;
  totalRooms: number;
  finishedRooms: number;
  cancelledRooms: number;
  playingRooms: number;
  avgDurationSeconds: number;
  avgDurationMinutes: number;
  finishedGamesCounted: number;
};

function AdminStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setData((await res.json()) as StatsResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl border border-line-subtle bg-bg-surface p-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-primary">Statistika</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Real-time loyiha ko‘rsatkichlari.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium text-ink-secondary disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          {loading ? <Spinner /> : "↻"}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Foydalanuvchilar"
          value={data?.totalUsers}
          loading={loading}
          hint="Telegram orqali ro‘yxatdan o‘tganlar"
        />
        <StatCard
          label="Tugagan o‘yinlar"
          value={data?.finishedRooms}
          loading={loading}
          hint="GameHistory (CANCELLED'siz)"
        />
        <StatCard
          label="O‘rtacha vaqt"
          value={
            data?.avgDurationMinutes != null
              ? `${data.avgDurationMinutes} daq`
              : undefined
          }
          loading={loading}
          hint={
            data?.finishedGamesCounted
              ? `5 daqiqadan ko‘p o‘ynalgan ${data.finishedGamesCounted} ta o‘yin asosida`
              : "5 daqiqadan ko‘p o‘ynalgan o‘yin yo‘q"
          }
        />
        <StatCard
          label="Hozir o‘ynalmoqda"
          value={data?.playingRooms}
          loading={loading}
          hint="status = PLAYING"
        />
        <StatCard
          label="Bekor qilingan"
          value={data?.cancelledRooms}
          loading={loading}
          hint="24 soatdan keyin avto-bekor"
        />
        <StatCard
          label="Jami room'lar"
          value={data?.totalRooms}
          loading={loading}
          hint="Lobby ham, tugaganlar ham"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading
}: {
  label: string;
  value: number | string | undefined;
  hint?: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      {loading || value === undefined ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-bg-elevated" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-ink-primary">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function FormModal({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  loading = false,
  children
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
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
            disabled={loading}
            className="grid h-7 w-7 place-items-center rounded-full border border-line-strong bg-bg-elevated text-xs disabled:opacity-50"
          >
            ×
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-10 flex-1 rounded-lg border border-line-strong bg-bg-elevated text-xs font-medium disabled:opacity-50"
          >
            Bekor
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand text-xs font-semibold text-bg-base disabled:opacity-60"
          >
            {loading ? (
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden
              />
            ) : null}
            {loading ? "Yuborilmoqda..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled = false
}: {
  field: FieldConfig;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  const baseClass =
    "w-full rounded-lg border border-line-strong bg-bg-base px-3 py-2 text-xs text-ink-primary outline-none focus:border-brand disabled:opacity-60";

  if (field.type === "textarea") {
    return (
      <label className="grid gap-1 text-xs">
        <span className="text-ink-muted">{field.label}</span>
        <textarea
          required={field.required}
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
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
        disabled={disabled}
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

function formatDifficulty(difficulty: unknown) {
  switch (difficulty) {
    case "EASY":
      return "Oson";
    case "MEDIUM":
      return "O'rta";
    case "HARD":
      return "Qiyin";
    default:
      return String(difficulty ?? "");
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
