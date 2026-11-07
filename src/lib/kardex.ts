export const PACK_SIZE = 15;

export type BrandId = "inka" | "rmt";

export const BRANDS: { id: BrandId; name: string; mark: string }[] = [
  { id: "inka", name: "Inka Express", mark: "IE" },
  { id: "rmt", name: "RMT", mark: "R" },
];

const BRAND_NAME: Record<BrandId, string> = {
  inka: "Inka Express",
  rmt: "RMT",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

export type MoveKind = "inicial" | "lunes" | "ingreso" | "salida";

export type ManualMove = {
  id: string;
  createdAt: number;
  date: string;
  brand: BrandId;
  kind: "ingreso" | "salida";
  packages: number;
  concept: string;
};

export type AutoMonday = {
  brand: BrandId;
  date: string;
  packages: number;
};

export type Settings = {
  openingDate: string;
  initial: Record<BrandId, number>;
  weekly: Record<BrandId, number>;
};

export type Store = {
  settings: Settings;
  manuals: ManualMove[];
  mondays: AutoMonday[];
  skipped: string[];
};

export type LedgerRow = {
  id: string;
  date: string;
  brand: BrandId;
  kind: MoveKind;
  concept: string;
  entrada: number;
  salida: number;
  saldo: number;
  auto: boolean;
  manualId?: string;
};

export type StoreResult = { ok: true; store: Store } | { ok: false; error: string };

const STORAGE_KEY = "cardex-agua-v1";
const MAX_PACKS = 100000;

export function isBrand(value: unknown): value is BrandId {
  return value === "inka" || value === "rmt";
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function weekdayISO(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDays(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86400000);
}

export function formatQty(n: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function formatShort(iso: string): string {
  const d = Number(iso.slice(8, 10));
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatHeadingDate(iso: string): string {
  const d = Number(iso.slice(8, 10));
  const m = Number(iso.slice(5, 7));
  const label = `${WEEKDAYS[weekdayISO(iso)]} ${d} ${MONTHS[m - 1]}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function bottlesOf(packages: number): number {
  return packages * PACK_SIZE;
}

export function relativeFuture(from: string, to: string): string {
  const n = diffDays(from, to);
  if (n <= 0) return "Hoy";
  if (n === 1) return "Mañana";
  return `En ${n} días`;
}

export function listMondaysAfter(opening: string, through: string): string[] {
  if (!isISODate(opening) || !isISODate(through) || through <= opening) return [];
  let date = addDaysISO(opening, 1);
  for (let i = 0; i < 7 && weekdayISO(date) !== 1; i += 1) date = addDaysISO(date, 1);
  const dates: string[] = [];
  while (date <= through && dates.length < 300) {
    dates.push(date);
    date = addDaysISO(date, 7);
  }
  return dates;
}

export function nextAutoMonday(today: string, opening: string): string {
  const after = today > opening ? today : opening;
  let date = addDaysISO(after, 1);
  for (let i = 0; i < 7 && weekdayISO(date) !== 1; i += 1) date = addDaysISO(date, 1);
  return date;
}

export function defaultStore(today: string): Store {
  return {
    settings: {
      openingDate: today,
      initial: { inka: 200, rmt: 70 },
      weekly: { inka: 50, rmt: 20 },
    },
    manuals: [],
    mondays: [],
    skipped: [],
  };
}

function clampPacks(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_PACKS, Math.max(0, Math.round(n)));
}

export function mondayKey(brand: BrandId, date: string): string {
  return `${brand}|${date}`;
}

function isPostableMonday(date: string, opening: string, today: string): boolean {
  return isISODate(date) && date > opening && date <= today && weekdayISO(date) === 1;
}

function sameMondays(a: AutoMonday[], b: AutoMonday[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].brand !== b[i].brand || a[i].date !== b[i].date || a[i].packages !== b[i].packages) return false;
  }
  return true;
}

function sameStrings(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function withReconciledMondays(store: Store, today: string): Store {
  const opening = store.settings.openingDate;
  const map = new Map<string, AutoMonday>();
  for (const entry of store.mondays) {
    if (!isBrand(entry.brand) || !isPostableMonday(entry.date, opening, today)) continue;
    map.set(mondayKey(entry.brand, entry.date), {
      brand: entry.brand,
      date: entry.date,
      packages: clampPacks(entry.packages, 0),
    });
  }
  const skipped = store.skipped
    .filter((key) => {
      const brand = key.slice(0, key.indexOf("|"));
      const date = key.slice(key.indexOf("|") + 1);
      return isBrand(brand) && isPostableMonday(date, opening, today);
    })
    .sort();

  for (const brand of BRANDS) {
    for (const date of listMondaysAfter(opening, today)) {
      const key = mondayKey(brand.id, date);
      if (map.has(key) || skipped.includes(key)) continue;
      const packages = store.settings.weekly[brand.id];
      if (packages <= 0) continue;
      map.set(key, { brand: brand.id, date, packages });
    }
  }

  const mondays = [...map.values()].sort((a, b) => (a.date === b.date ? a.brand.localeCompare(b.brand) : a.date < b.date ? -1 : 1));
  if (sameMondays(mondays, store.mondays) && sameStrings(skipped, store.skipped)) return store;
  return { ...store, mondays, skipped };
}

function parseManual(value: unknown): ManualMove | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isBrand(row.brand) || (row.kind !== "ingreso" && row.kind !== "salida") || !isISODate(row.date)) return null;
  const packages = clampPacks(row.packages, 0);
  if (packages < 1) return null;
  const concept = typeof row.concept === "string" && row.concept.trim() ? row.concept.trim().slice(0, 80) : row.kind === "ingreso" ? "Ingreso adicional" : "Salida de almacén";
  const id = typeof row.id === "string" && row.id ? row.id : crypto.randomUUID();
  const createdAt = typeof row.createdAt === "number" && Number.isFinite(row.createdAt) ? row.createdAt : 0;
  return { id, createdAt, date: row.date, brand: row.brand, kind: row.kind, packages, concept };
}

export function sanitizeStore(value: unknown, today: string): Store {
  const base = defaultStore(today);
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  const settingsRaw = raw.settings && typeof raw.settings === "object" ? (raw.settings as Record<string, unknown>) : {};
  const initialRaw = settingsRaw.initial && typeof settingsRaw.initial === "object" ? (settingsRaw.initial as Record<string, unknown>) : {};
  const weeklyRaw = settingsRaw.weekly && typeof settingsRaw.weekly === "object" ? (settingsRaw.weekly as Record<string, unknown>) : {};
  const settings: Settings = {
    openingDate: isISODate(settingsRaw.openingDate) ? settingsRaw.openingDate : today,
    initial: {
      inka: clampPacks(initialRaw.inka, base.settings.initial.inka),
      rmt: clampPacks(initialRaw.rmt, base.settings.initial.rmt),
    },
    weekly: {
      inka: clampPacks(weeklyRaw.inka, base.settings.weekly.inka),
      rmt: clampPacks(weeklyRaw.rmt, base.settings.weekly.rmt),
    },
  };
  const manuals = Array.isArray(raw.manuals) ? raw.manuals.flatMap((row) => {
    const parsed = parseManual(row);
    return parsed ? [parsed] : [];
  }) : [];
  const seen = new Set<string>();
  const uniqueManuals = manuals.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  const mondays = Array.isArray(raw.mondays) ? raw.mondays.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const entry = row as Record<string, unknown>;
    if (!isBrand(entry.brand) || !isISODate(entry.date)) return [];
    return [{ brand: entry.brand, date: entry.date, packages: clampPacks(entry.packages, 0) }];
  }) : [];
  const skipped = Array.isArray(raw.skipped) ? raw.skipped.filter((key): key is string => typeof key === "string") : [];
  return { settings, manuals: uniqueManuals, mondays, skipped };
}

export function loadStore(today: string): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore(today);
    return sanitizeStore(JSON.parse(raw), today);
  } catch {
    return defaultStore(today);
  }
}

export function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode or quota */
  }
}

const KIND_ORDER: Record<MoveKind, number> = { inicial: 0, lunes: 1, ingreso: 2, salida: 3 };

export function buildLedger(store: Store, brand: BrandId): LedgerRow[] {
  const rows: Omit<LedgerRow, "saldo">[] = [
    {
      id: `inicial:${brand}`,
      date: store.settings.openingDate,
      brand,
      kind: "inicial",
      concept: "Inventario inicial",
      entrada: store.settings.initial[brand],
      salida: 0,
      auto: true,
    },
  ];

  for (const entry of store.mondays) {
    if (entry.brand !== brand || store.skipped.includes(mondayKey(brand, entry.date))) continue;
    rows.push({
      id: `lunes:${brand}:${entry.date}`,
      date: entry.date,
      brand,
      kind: "lunes",
      concept: "Ingreso de lunes",
      entrada: entry.packages,
      salida: 0,
      auto: true,
    });
  }

  for (const manual of store.manuals) {
    if (manual.brand !== brand) continue;
    rows.push({
      id: manual.id,
      date: manual.date,
      brand,
      kind: manual.kind,
      concept: manual.concept,
      entrada: manual.kind === "ingreso" ? manual.packages : 0,
      salida: manual.kind === "salida" ? manual.packages : 0,
      auto: false,
      manualId: manual.id,
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.id < b.id ? -1 : 1;
  });

  let saldo = 0;
  return rows.map((row) => {
    saldo += row.entrada - row.salida;
    return { ...row, saldo };
  });
}

export function totalsAsOf(rows: LedgerRow[], today: string): { entrada: number; salida: number; stock: number } {
  let entrada = 0;
  let salida = 0;
  for (const row of rows) {
    if (row.date > today) continue;
    entrada += row.entrada;
    salida += row.salida;
  }
  return { entrada, salida, stock: entrada - salida };
}

export function skippedFor(store: Store, brand: BrandId): AutoMonday[] {
  return store.mondays
    .filter((entry) => entry.brand === brand && store.skipped.includes(mondayKey(brand, entry.date)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function balanceProblem(store: Store): string | null {
  for (const brand of BRANDS) {
    const bad = buildLedger(store, brand.id).find((row) => row.saldo < 0);
    if (bad) {
      return `El saldo de ${BRAND_NAME[brand.id]} quedaría en ${formatQty(bad.saldo)} paquetes el ${formatShort(bad.date)}.`;
    }
  }
  return null;
}

export function addManual(
  store: Store,
  input: { brand: BrandId; kind: "ingreso" | "salida"; date: string; packages: number; concept: string },
  today: string,
): StoreResult {
  if (!Number.isInteger(input.packages) || input.packages < 1 || input.packages > MAX_PACKS) {
    return { ok: false, error: "Indica los paquetes con un número entero, de 1 a 100000." };
  }
  if (!isISODate(input.date)) return { ok: false, error: "La fecha no es válida." };
  if (input.date < store.settings.openingDate) {
    return { ok: false, error: "La fecha es anterior al inventario inicial." };
  }
  if (input.date > today) {
    return { ok: false, error: "Esa fecha todavía no llega. El lote del lunes se anota solo." };
  }
  const concept = input.concept.trim().slice(0, 80) || (input.kind === "ingreso" ? "Ingreso adicional" : "Salida de almacén");
  const next: Store = {
    ...store,
    manuals: [
      ...store.manuals,
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        date: input.date,
        brand: input.brand,
        kind: input.kind,
        packages: input.packages,
        concept,
      },
    ],
  };
  const error = balanceProblem(next);
  if (error) {
    return { ok: false, error: input.kind === "salida" ? `No hay saldo suficiente. ${error}` : error };
  }
  return { ok: true, store: next };
}

export function removeManual(store: Store, id: string): StoreResult {
  const next = { ...store, manuals: store.manuals.filter((row) => row.id !== id) };
  const error = balanceProblem(next);
  if (error) return { ok: false, error };
  return { ok: true, store: next };
}

export function skipMonday(store: Store, brand: BrandId, date: string, today: string): StoreResult {
  if (!isPostableMonday(date, store.settings.openingDate, today)) {
    return { ok: false, error: "Ese lunes todavía no entra al cardex." };
  }
  const key = mondayKey(brand, date);
  let mondays = store.mondays;
  if (!mondays.some((entry) => entry.brand === brand && entry.date === date)) {
    const packages = store.settings.weekly[brand];
    if (packages <= 0) return { ok: false, error: "Ese lunes no tiene paquetes anotados." };
    mondays = [...mondays, { brand, date, packages }];
  }
  const skipped = store.skipped.includes(key) ? store.skipped : [...store.skipped, key];
  const next = withReconciledMondays({ ...store, mondays, skipped }, today);
  const error = balanceProblem(next);
  if (error) return { ok: false, error };
  return { ok: true, store: next };
}

export function restoreMonday(store: Store, brand: BrandId, date: string, today: string): StoreResult {
  const key = mondayKey(brand, date);
  const next = withReconciledMondays({ ...store, skipped: store.skipped.filter((item) => item !== key) }, today);
  const error = balanceProblem(next);
  if (error) return { ok: false, error };
  return { ok: true, store: next };
}

export function applySettings(store: Store, settings: Settings, today: string): StoreResult {
  if (!isISODate(settings.openingDate)) return { ok: false, error: "La fecha inicial no es válida." };
  if (diffDays(settings.openingDate, today) > 260 * 7) {
    return { ok: false, error: "La fecha inicial no puede tener más de 5 años." };
  }
  if (diffDays(today, settings.openingDate) > 366) {
    return { ok: false, error: "La fecha inicial no puede pasar de un año." };
  }
  const early = store.manuals.find((row) => row.date < settings.openingDate);
  if (early) {
    return { ok: false, error: `Hay un movimiento del ${formatShort(early.date)}, antes de esa fecha.` };
  }
  const clean: Settings = {
    openingDate: settings.openingDate,
    initial: {
      inka: clampPacks(settings.initial.inka, 0),
      rmt: clampPacks(settings.initial.rmt, 0),
    },
    weekly: {
      inka: clampPacks(settings.weekly.inka, 0),
      rmt: clampPacks(settings.weekly.rmt, 0),
    },
  };
  const next = withReconciledMondays({ ...store, settings: clean }, today);
  const error = balanceProblem(next);
  if (error) return { ok: false, error };
  return { ok: true, store: next };
}
