"use client";

import { useEffect, useState } from "react";

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

type ModelDefinition = {
  label: string;
  description: string;
  listFields: Array<{
    label: string;
    render: (item: AdminItem) => string;
  }>;
  createFields?: FieldConfig[];
  editFields?: FieldConfig[];
  allowDelete?: boolean;
};

type FormState = Record<string, string | number | boolean>;

const cardTypeOptions = [
  { label: "Kasb", value: "PROFESSION" },
  { label: "Sog'liq", value: "HEALTH" },
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

const modelDefinitions: Record<string, ModelDefinition> = {
  cards: {
    label: "Kartalar",
    description: "Kasb, sog'liq, xarakter va boshqa o'yin kartalari.",
    createFields: [
      { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
      { key: "text", label: "Matn", type: "textarea", required: true }
    ],
    editFields: [
      { key: "type", label: "Turi", type: "select", required: true, options: cardTypeOptions },
      { key: "text", label: "Matn", type: "textarea", required: true }
    ],
    allowDelete: true,
    listFields: [
      { label: "Turi", render: (item) => formatCardType(item.type) },
      { label: "Matn", render: (item) => String(item.text ?? "") }
    ]
  },
  disasters: {
    label: "Falokatlar",
    description: "O'yin boshidagi global disaster ssenariylari.",
    createFields: [
      { key: "name", label: "Nomi", type: "text", required: true },
      { key: "description", label: "Tavsif", type: "textarea", required: true }
    ],
    editFields: [
      { key: "name", label: "Nomi", type: "text", required: true },
      { key: "description", label: "Tavsif", type: "textarea", required: true }
    ],
    allowDelete: true,
    listFields: [
      { label: "Nomi", render: (item) => String(item.name ?? "") },
      { label: "Tavsif", render: (item) => String(item.description ?? "") }
    ]
  },
  situations: {
    label: "Situation'lar",
    description: "Round boshida chiqadigan vaziyat kartalari.",
    createFields: [
      { key: "text", label: "Matn", type: "textarea", required: true },
      {
        key: "difficulty",
        label: "Daraja",
        type: "select",
        required: true,
        options: difficultyOptions
      }
    ],
    editFields: [
      { key: "text", label: "Matn", type: "textarea", required: true },
      {
        key: "difficulty",
        label: "Daraja",
        type: "select",
        required: true,
        options: difficultyOptions
      }
    ],
    allowDelete: true,
    listFields: [
      { label: "Daraja", render: (item) => String(item.difficulty ?? "") },
      { label: "Matn", render: (item) => String(item.text ?? "") }
    ]
  },
  players: {
    label: "O'yinchilar",
    description: "Room'ga qo'shilgan foydalanuvchilar ro'yxati.",
    editFields: [
      { key: "name", label: "Nickname", type: "text", required: true },
      { key: "isHost", label: "Host", type: "checkbox" },
      { key: "isAlive", label: "Tirik", type: "checkbox" }
    ],
    listFields: [
      { label: "Nickname", render: (item) => String(item.name ?? "") },
      { label: "Room", render: (item) => String(item.roomId ?? "") },
      { label: "Holat", render: (item) => (item.isAlive ? "Tirik" : "Chiqqan") },
      { label: "Roli", render: (item) => (item.isHost ? "Host" : "Player") }
    ]
  },
  rooms: {
    label: "Room'lar",
    description: "Aktiv va tugagan xonalar holati.",
    listFields: [
      { label: "Code", render: (item) => String(item.code ?? "") },
      { label: "Status", render: (item) => String(item.status ?? "") },
      {
        label: "Playerlar",
        render: (item) => String(Array.isArray(item.players) ? item.players.length : 0)
      },
      { label: "Finish", render: (item) => `${String(item.winnerTarget ?? "-")} kishi` }
    ]
  },
  games: {
    label: "O'yinlar",
    description: "Game state va round jarayonlari.",
    listFields: [
      { label: "Phase", render: (item) => String(item.phase ?? "") },
      { label: "Round", render: (item) => String(item.roundNumber ?? 0) },
      { label: "Falokat", render: (item) => String(item.disaster?.name ?? "-") },
      { label: "Situation", render: (item) => String(item.currentSituation?.text ?? "-") }
    ]
  },
  playerAttributes: {
    label: "Player kartalari",
    description: "Har bir player'ga tushgan atributlar.",
    listFields: [
      { label: "Player", render: (item) => String(item.player?.name ?? "") },
      { label: "Kasb", render: (item) => String(item.profession ?? "") },
      { label: "Sog'liq", render: (item) => String(item.health ?? "") },
      { label: "Xarakter", render: (item) => String(item.character ?? "") }
    ]
  },
  votes: {
    label: "Ovozlar",
    description: "Round bo'yicha berilgan ovozlar.",
    listFields: [
      { label: "Round", render: (item) => String(item.roundNumber ?? 0) },
      { label: "Kim berdi", render: (item) => String(item.voterPlayer?.name ?? "") },
      { label: "Kimga", render: (item) => String(item.targetPlayer?.name ?? "") },
      { label: "Room", render: (item) => String(item.room?.code ?? "") }
    ]
  }
};

export function AdminDashboard() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [createState, setCreateState] = useState<FormState>({});
  const [editState, setEditState] = useState<FormState>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const definition = modelDefinitions[selectedModel];
  const createFields = definition?.createFields ?? [];
  const editFields = definition?.editFields ?? [];

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

    setEditingId(null);
    setError(null);
    setMessage(null);
    setCreateState(buildInitialState(createFields));
    setEditState(buildInitialState(editFields));
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
    if (!definition?.createFields?.length) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      await fetch(`/api/admin/${selectedModel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeState(createFields, createState))
      }).then(assertOk);

      setCreateState(buildInitialState(createFields));
      setMessage("Yangi yozuv qo'shildi.");
      await loadItems(selectedModel);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function updateItem() {
    if (!editingId || !definition?.editFields?.length) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      await fetch(`/api/admin/${selectedModel}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeState(editFields, editState))
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

      if (editingId === id) {
        setEditingId(null);
        setEditState(buildInitialState(editFields));
      }

      setMessage("Yozuv o'chirildi.");
      await loadItems(selectedModel);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function startEditing(item: AdminItem) {
    if (!definition?.editFields?.length || !item.id) {
      return;
    }

    setEditingId(String(item.id));
    setEditState(buildStateFromItem(editFields, item));
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
              {modelDefinitions[model]?.label ?? model}
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
              <h1 className="mt-2 text-3xl font-semibold text-white">
                {definition?.label ?? selectedModel}
              </h1>
              {definition?.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {definition.description}
                </p>
              ) : null}
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

        {createFields.length || editFields.length ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Yangi yozuv</h2>
              {createFields.length ? (
                <>
                  <div className="mt-4 grid gap-4">
                    {createFields.map((field) => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={createState[field.key]}
                        onChange={(value) =>
                          setCreateState((current) => ({ ...current, [field.key]: value }))
                        }
                      />
                    ))}
                  </div>
                  <button
                    onClick={createItem}
                    className="mt-4 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Qo'shish
                  </button>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Bu jadval uchun create form kerak emas.
                </p>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Tahrirlash</h2>
              {editFields.length ? (
                <>
                  {editingId ? (
                    <div className="mt-4 grid gap-4">
                      {editFields.map((field) => (
                        <FieldInput
                          key={field.key}
                          field={field}
                          value={editState[field.key]}
                          onChange={(value) =>
                            setEditState((current) => ({ ...current, [field.key]: value }))
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Pastdagi ro'yxatdan kerakli yozuvni tanlang.
                    </p>
                  )}

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
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Bu jadval read-only ko'rinishda.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4">
          {items.map((item, index) => (
            <article
              key={String(item.id ?? index)}
              className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {resolveItemTitle(selectedModel, item, index)}
                  </p>
                  {item.id ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                      {String(item.id)}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {editFields.length && item.id ? (
                    <button
                      onClick={() => startEditing(item)}
                      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Edit
                    </button>
                  ) : null}
                  {definition?.allowDelete && item.id ? (
                    <button
                      onClick={() => void deleteItem(String(item.id))}
                      className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {definition?.listFields.map((field) => (
                  <div
                    key={field.label}
                    className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      {field.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-100">
                      {field.render(item) || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
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
  const commonClassName =
    "w-full rounded-[1.25rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none";

  if (field.type === "textarea") {
    return (
      <label className="grid gap-2 text-sm text-slate-300">
        {field.label}
        <textarea
          required={field.required}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={`${commonClassName} min-h-[128px]`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="grid gap-2 text-sm text-slate-300">
        {field.label}
        <select
          required={field.required}
          value={String(value ?? field.options?.[0]?.value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={commonClassName}
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
      <label className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
        <span>{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4"
        />
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {field.label}
      <input
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        value={String(value ?? "")}
        onChange={(event) =>
          onChange(field.type === "number" ? Number(event.target.value) : event.target.value)
        }
        className={commonClassName}
      />
    </label>
  );
}

function buildInitialState(fields: FieldConfig[]) {
  return fields.reduce<FormState>((accumulator, field) => {
    if (field.type === "checkbox") {
      accumulator[field.key] = false;
    } else if (field.type === "number") {
      accumulator[field.key] = 0;
    } else if (field.type === "select") {
      accumulator[field.key] = field.options?.[0]?.value ?? "";
    } else {
      accumulator[field.key] = "";
    }

    return accumulator;
  }, {});
}

function buildStateFromItem(fields: FieldConfig[], item: AdminItem) {
  return fields.reduce<FormState>((accumulator, field) => {
    if (field.type === "checkbox") {
      accumulator[field.key] = Boolean(item[field.key]);
    } else if (field.type === "number") {
      accumulator[field.key] = Number(item[field.key] ?? 0);
    } else {
      accumulator[field.key] = String(item[field.key] ?? "");
    }

    return accumulator;
  }, {});
}

function serializeState(fields: FieldConfig[], state: FormState) {
  return fields.reduce<Record<string, string | number | boolean>>((accumulator, field) => {
    accumulator[field.key] = state[field.key];
    return accumulator;
  }, {});
}

function resolveItemTitle(model: string, item: AdminItem, index: number) {
  if (model === "cards") {
    return `${formatCardType(item.type)} kartasi`;
  }

  if (model === "disasters") {
    return String(item.name ?? `Falokat ${index + 1}`);
  }

  if (model === "situations") {
    return `Situation ${index + 1}`;
  }

  if (model === "players") {
    return String(item.name ?? `Player ${index + 1}`);
  }

  if (model === "rooms") {
    return `Room ${String(item.code ?? index + 1)}`;
  }

  if (model === "games") {
    return `Game ${index + 1}`;
  }

  if (model === "playerAttributes") {
    return String(item.player?.name ?? `Atribut ${index + 1}`);
  }

  if (model === "votes") {
    return `Vote ${index + 1}`;
  }

  return String(item.id ?? `${model}-${index}`);
}

function formatCardType(type: unknown) {
  switch (type) {
    case "PROFESSION":
      return "Kasb";
    case "HEALTH":
      return "Sog'liq";
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

async function assertOk(response: Response) {
  if (response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => ({ message: "Xatolik yuz berdi." }));
  throw new Error(payload.message ?? "Xatolik yuz berdi.");
}
