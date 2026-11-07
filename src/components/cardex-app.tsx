import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarClock, Minus, Plus, SlidersHorizontal } from "lucide-react";
import {
  BRANDS,
  PACK_SIZE,
  addManual,
  applySettings,
  bottlesOf,
  buildLedger,
  defaultStore,
  formatHeadingDate,
  formatQty,
  formatShort,
  listMondaysAfter,
  loadStore,
  localISODate,
  nextAutoMonday,
  relativeFuture,
  removeManual,
  restoreMonday,
  saveStore,
  skipMonday,
  skippedFor,
  totalsAsOf,
  withReconciledMondays,
  type BrandId,
  type LedgerRow,
  type Settings,
  type Store,
} from "@/lib/kardex";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Dialog =
  | { type: "move"; kind: "ingreso" | "salida"; brand: BrandId }
  | { type: "settings" }
  | { type: "skip"; brand: BrandId; date: string }
  | { type: "delete"; id: string; concept: string }
  | null;

export function CardexApp() {
  const [today, setToday] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const current = localISODate(new Date());
    setToday(current);
    setStore(withReconciledMondays(loadStore(current), current));
  }, []);

  useEffect(() => {
    if (!today || !store) return;
    const next = withReconciledMondays(store, today);
    if (next !== store) setStore(next);
  }, [store, today]);

  useEffect(() => {
    if (!store || !today) return;
    saveStore(store);
  }, [store, today]);

  useEffect(() => {
    const tick = () => {
      const current = localISODate(new Date());
      setToday((prev) => (prev === current ? prev : current));
    };
    const id = window.setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  if (!today || !store) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
        <p className="text-xs font-semibold tracking-wide text-lagoon uppercase">Almacén de agua</p>
        <h1 className="mt-2 text-4xl text-ink">Cardex de ingreso</h1>
        <p className="mt-3 max-w-xl text-muted">Cargando paquetes de Inka Express y RMT.</p>
      </main>
    );
  }

  const ledgers = BRANDS.map((brand) => {
    const rows = buildLedger(store, brand.id);
    return { brand, rows, totals: totalsAsOf(rows, today) };
  });
  const stockPacks = ledgers.reduce((sum, item) => sum + item.totals.stock, 0);
  const stockBottles = bottlesOf(stockPacks);
  const opening = store.settings.openingDate;
  const received = opening <= today;
  const upcoming = nextAutoMonday(today, opening);
  const initialIsNext = opening > today;

  function apply(result: { ok: true; store: Store } | { ok: false; error: string }): string | null {
    if (!result.ok) return result.error;
    setStore(result.store);
    setNotice(null);
    setDialog(null);
    return null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-lagoon uppercase">Almacén de agua</p>
          <h1 className="mt-1 text-4xl text-ink sm:text-5xl">Cardex de ingreso</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Partimos con {formatQty(store.settings.initial.inka)} paquetes de Inka Express y{" "}
            {formatQty(store.settings.initial.rmt)} de RMT el {formatShort(opening)}. Desde el lunes siguiente entran{" "}
            {formatQty(store.settings.weekly.inka)} y {formatQty(store.settings.weekly.rmt)} cada semana. Cada paquete trae{" "}
            {PACK_SIZE} botellas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setDialog({ type: "settings" });
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-paper"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Ajustar regla
          </button>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setDialog({ type: "move", kind: "ingreso", brand: "inka" });
            }}
            disabled={!received}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lagoon px-4 text-sm font-semibold text-on-lagoon hover:bg-lagoon-deep disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Registrar ingreso
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-card bg-lagoon p-5 text-on-lagoon shadow-card lg:col-span-2">
          <p className="text-sm font-semibold tracking-wide text-on-lagoon-muted uppercase">
            {received ? "En almacén" : "Por recibir"}
          </p>
          <p className="mt-2 font-display text-5xl leading-none tabular-nums sm:text-6xl">{formatQty(received ? stockBottles : bottlesOf(store.settings.initial.inka + store.settings.initial.rmt))}</p>
          <p className="mt-2 text-on-lagoon-muted">
            {received
              ? `${formatQty(stockPacks)} paquetes · ${PACK_SIZE} botellas cada uno`
              : `Llegan el ${formatShort(opening)} · todavía no están en almacén`}
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {ledgers.map(({ brand, totals }) => (
              <div key={brand.id} className="flex items-center gap-3 border-t border-lagoon-line pt-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lagoon-deep font-display text-lg text-on-lagoon">
                  {brand.mark}
                </span>
                <div className="min-w-0">
                  <dt className="font-semibold">{brand.name}</dt>
                  <dd className="text-sm text-on-lagoon-muted tabular-nums">
                    {received
                      ? `${formatQty(totals.stock)} paquetes · ${formatQty(bottlesOf(totals.stock))} botellas`
                      : `${formatQty(store.settings.initial[brand.id])} paquetes al llegar`}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <aside className="flex flex-col justify-between rounded-card border border-line bg-card p-5 shadow-card">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-clay-soft text-clay">
                <CalendarClock className="size-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold tracking-wide text-clay uppercase">
                {initialIsNext ? "Próximo movimiento" : "Cada lunes"}
              </p>
            </div>
            <h2 className="mt-4 text-3xl text-ink">
              {initialIsNext ? formatHeadingDate(opening) : formatHeadingDate(upcoming)}
            </h2>
            <p className="mt-1 text-sm text-muted">{relativeFuture(today, initialIsNext ? opening : upcoming)}</p>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {initialIsNext ? (
              <p className="text-ink">
                Entra el inventario inicial: {formatQty(store.settings.initial.inka)} paquetes de Inka Express y{" "}
                {formatQty(store.settings.initial.rmt)} de RMT.
              </p>
            ) : (
              BRANDS.map((brand) => (
                <p key={brand.id} className="flex items-baseline justify-between gap-3 tabular-nums">
                  <span className="text-ink">{brand.name}</span>
                  <span className="font-semibold text-lagoon">
                    +{formatQty(store.settings.weekly[brand.id])} paq
                    <span className="mt-0.5 block text-right text-xs font-medium text-muted">
                      {formatQty(bottlesOf(store.settings.weekly[brand.id]))} bot.
                    </span>
                  </span>
                </p>
              ))
            )}
            <p className="text-xs text-muted">
              {initialIsNext
                ? "Después, cada lunes se suma solo el lote semanal."
                : "Si no abres el cardex un lunes, el lote queda anotado cuando vuelvas."}
            </p>
          </div>
        </aside>
      </section>

      {notice ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {ledgers.map(({ brand, rows, totals }) => (
          <BrandCard
            key={brand.id}
            brandId={brand.id}
            name={brand.name}
            mark={brand.mark}
            rows={rows}
            stock={totals.stock}
            entered={totals.entrada}
            left={totals.salida}
            weekly={store.settings.weekly[brand.id]}
            today={today}
            skipped={skippedFor(store, brand.id)}
            received={received}
            onMove={(kind) => {
              setNotice(null);
              setDialog({ type: "move", kind, brand: brand.id });
            }}
            onSkip={(date) => {
              setNotice(null);
              setDialog({ type: "skip", brand: brand.id, date });
            }}
            onDelete={(id, concept) => {
              setNotice(null);
              setDialog({ type: "delete", id, concept });
            }}
            onRestore={(date) => {
              const result = restoreMonday(store, brand.id, date, today);
              if (!result.ok) setNotice(result.error);
              else setStore(result.store);
            }}
          />
        ))}
      </div>

      {dialog?.type === "move" ? (
        <MoveDialog
          store={store}
          today={today}
          initialKind={dialog.kind}
          initialBrand={dialog.brand}
          onClose={() => setDialog(null)}
          onSave={(input) => apply(addManual(store, input, today))}
        />
      ) : null}
      {dialog?.type === "settings" ? (
        <SettingsDialog
          store={store}
          today={today}
          onClose={() => setDialog(null)}
          onSave={(settings) => apply(applySettings(store, settings, today))}
          onReset={() => {
            setStore(defaultStore(today));
            setNotice(null);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.type === "skip" ? (
        <ConfirmDialog
          title="Quitar el ingreso de este lunes"
          body={`Se descuenta el lote del ${formatShort(dialog.date)}. Puedes restaurarlo después.`}
          confirmLabel="Quitar lote"
          onClose={() => setDialog(null)}
          onConfirm={() => apply(skipMonday(store, dialog.brand, dialog.date, today))}
        />
      ) : null}
      {dialog?.type === "delete" ? (
        <ConfirmDialog
          title="Quitar movimiento"
          body={`Se borra «${dialog.concept}» del cardex.`}
          confirmLabel="Quitar"
          onClose={() => setDialog(null)}
          onConfirm={() => apply(removeManual(store, dialog.id))}
        />
      ) : null}
    </main>
  );
}

function BrandCard({
  brandId,
  name,
  mark,
  rows,
  stock,
  entered,
  left,
  weekly,
  today,
  skipped,
  received,
  onMove,
  onSkip,
  onDelete,
  onRestore,
}: {
  brandId: BrandId;
  name: string;
  mark: string;
  rows: LedgerRow[];
  stock: number;
  entered: number;
  left: number;
  weekly: number;
  today: string;
  skipped: { date: string; packages: number }[];
  received: boolean;
  onMove: (kind: "ingreso" | "salida") => void;
  onSkip: (date: string) => void;
  onDelete: (id: string, concept: string) => void;
  onRestore: (date: string) => void;
}) {
  const tone = brandId === "inka";
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <div className={cx("h-1.5", tone ? "bg-lagoon" : "bg-clay")} />
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              "grid size-11 place-items-center rounded-xl font-display text-lg",
              tone ? "bg-lagoon-soft text-lagoon" : "bg-clay-soft text-clay",
            )}
          >
            {mark}
          </span>
          <div>
            <h2 className="text-2xl text-ink">{name}</h2>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              {weekly > 0 ? `+${formatQty(weekly)} paquetes cada lunes` : "Sin lote semanal"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl leading-none tabular-nums text-ink">{formatQty(received ? stock : 0)}</p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {formatQty(bottlesOf(received ? stock : 0))} botellas
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 px-4">
        <button
          type="button"
          disabled={!received}
          onClick={() => onMove("ingreso")}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-lagoon px-3 text-sm font-semibold text-on-lagoon hover:bg-lagoon-deep disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Ingreso
        </button>
        <button
          type="button"
          disabled={!received || stock <= 0}
          onClick={() => onMove("salida")}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-50"
        >
          <Minus className="size-4" aria-hidden="true" />
          Salida
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 px-4 text-xs font-semibold tracking-wide text-muted uppercase">
        <span>Entra</span>
        <span>Sale</span>
        <span className="text-right">Saldo</span>
      </div>
      <ul className="mt-1 max-h-80 overflow-auto">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-ink">{row.concept}</p>
              <p className="shrink-0 text-sm text-muted">{formatShort(row.date)}</p>
            </div>
            {row.date > today ? (
              <p className="mt-1 text-xs font-semibold tracking-wide text-clay uppercase">Programado</p>
            ) : null}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Qty value={row.entrada} sign="+" tone="in" label="Entrada" />
              <Qty value={row.salida} sign="−" tone="out" label="Salida" />
              <Qty value={row.saldo} tone="bal" label="Saldo" align="right" />
            </div>
            {row.kind === "lunes" && row.date <= today ? (
              <button type="button" onClick={() => onSkip(row.date)} className="mt-2 min-h-11 text-sm font-semibold text-clay">
                Este lunes no llegó
              </button>
            ) : null}
            {row.manualId ? (
              <button
                type="button"
                onClick={() => onDelete(row.manualId as string, row.concept)}
                className="mt-2 min-h-11 text-sm font-semibold text-danger"
              >
                Quitar movimiento
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted tabular-nums">
        <span>Ingresados {formatQty(entered)}</span>
        <span>Salidas {formatQty(left)}</span>
      </div>
      {skipped.length > 0 ? (
        <div className="border-t border-line bg-paper px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Lunes que no llegaron</p>
          <ul className="mt-2 space-y-2">
            {skipped.map((entry) => (
              <li key={entry.date} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {formatShort(entry.date)} · {formatQty(entry.packages)} paq
                </span>
                <button type="button" onClick={() => onRestore(entry.date)} className="min-h-11 font-semibold text-lagoon">
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Qty({
  value,
  sign = "",
  tone,
  label,
  align = "left",
}: {
  value: number;
  sign?: string;
  tone: "in" | "out" | "bal";
  label: string;
  align?: "left" | "right";
}) {
  const show = tone === "bal" || value > 0;
  const color = tone === "in" ? "text-lagoon" : tone === "out" ? "text-clay" : "text-ink";
  return (
    <div className={cx(align === "right" && "text-right")} aria-label={show ? `${label}: ${value} paquetes, ${bottlesOf(value)} botellas` : `${label}: ninguna`}>
      <p className={cx("text-sm font-semibold tabular-nums", show ? color : "text-muted")}>
        {show ? `${sign}${formatQty(value)}` : "—"}
        {show ? <span className="font-medium text-muted"> paq</span> : null}
      </p>
      <p className="text-xs text-muted tabular-nums">{show ? `${formatQty(bottlesOf(value))} bot.` : "\u00a0"}</p>
    </div>
  );
}

function MoveDialog({
  store,
  today,
  initialKind,
  initialBrand,
  onClose,
  onSave,
}: {
  store: Store;
  today: string;
  initialKind: "ingreso" | "salida";
  initialBrand: BrandId;
  onClose: () => void;
  onSave: (input: { brand: BrandId; kind: "ingreso" | "salida"; date: string; packages: number; concept: string }) => string | null;
}) {
  const baseId = useId();
  const [kind, setKind] = useState(initialKind);
  const [brand, setBrand] = useState(initialBrand);
  const [date, setDate] = useState(today);
  const [packages, setPackages] = useState("");
  const [concept, setConcept] = useState(initialKind === "ingreso" ? "Ingreso adicional" : "Salida de almacén");
  const [error, setError] = useState<string | null>(null);
  const count = /^\d+$/.test(packages) ? Number(packages) : 0;

  return (
    <DialogShell title={kind === "ingreso" ? "Registrar ingreso" : "Registrar salida"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const amount = /^\d+$/.test(packages) ? Number(packages) : NaN;
          const message = onSave({ brand, kind, date, packages: amount, concept });
          if (message) setError(message);
        }}
      >
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
          {(["ingreso", "salida"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => {
                setKind(option);
                setConcept((current) => {
                  if (current === "Ingreso adicional" || current === "Salida de almacén" || current.trim() === "") {
                    return option === "ingreso" ? "Ingreso adicional" : "Salida de almacén";
                  }
                  return current;
                });
              }}
              className={cx(
                "min-h-11 rounded-lg text-sm font-semibold",
                kind === option ? "bg-lagoon text-on-lagoon" : "text-muted",
              )}
            >
              {option === "ingreso" ? "Ingreso" : "Salida"}
            </button>
          ))}
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Marca</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {BRANDS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={brand === item.id}
                onClick={() => setBrand(item.id)}
                className={cx(
                  "min-h-11 rounded-xl border px-3 text-sm font-semibold",
                  brand === item.id
                    ? item.id === "inka"
                      ? "border-lagoon bg-lagoon-soft text-lagoon"
                      : "border-clay bg-clay-soft text-clay"
                    : "border-line bg-card text-ink",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-ink" htmlFor={`${baseId}-date`}>
          Fecha
          <input
            id={`${baseId}-date`}
            type="date"
            required
            min={store.settings.openingDate}
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-card px-3 text-base text-ink"
          />
        </label>

        <div className="mt-4">
          <label className="text-sm font-medium text-ink" htmlFor={`${baseId}-packs`}>
            Paquetes
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              className="grid size-11 place-items-center rounded-xl border border-line bg-card text-ink"
              onClick={() => setPackages((current) => stepPacks(current, -1))}
              aria-label="Un paquete menos"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              id={`${baseId}-packs`}
              inputMode="numeric"
              value={packages}
              placeholder="0"
              onChange={(event) => setPackages(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-center font-display text-2xl text-ink tabular-nums"
            />
            <button
              type="button"
              className="grid size-11 place-items-center rounded-xl border border-line bg-card text-ink"
              onClick={() => setPackages((current) => stepPacks(current, 1))}
              aria-label="Un paquete más"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {count > 0 ? `${formatQty(count)} paquetes = ${formatQty(bottlesOf(count))} botellas` : `Cada paquete son ${PACK_SIZE} botellas.`}
          </p>
        </div>

        <label className="mt-4 block text-sm font-medium text-ink" htmlFor={`${baseId}-concept`}>
          Concepto
          <input
            id={`${baseId}-concept`}
            value={concept}
            maxLength={80}
            onChange={(event) => setConcept(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-line bg-card text-sm font-semibold text-ink">
            Cancelar
          </button>
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-lagoon text-sm font-semibold text-on-lagoon hover:bg-lagoon-deep">
            Guardar
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function stepPacks(current: string, delta: number): string {
  const n = /^\d+$/.test(current) ? Number(current) : 0;
  const next = Math.min(100000, Math.max(0, n + delta));
  return next === 0 ? "" : String(next);
}

function SettingsDialog({
  store,
  today,
  onClose,
  onSave,
  onReset,
}: {
  store: Store;
  today: string;
  onClose: () => void;
  onSave: (settings: Settings) => string | null;
  onReset: () => void;
}) {
  const baseId = useId();
  const [openingDate, setOpeningDate] = useState(store.settings.openingDate);
  const [inkaInitial, setInkaInitial] = useState(String(store.settings.initial.inka));
  const [rmtInitial, setRmtInitial] = useState(String(store.settings.initial.rmt));
  const [inkaWeekly, setInkaWeekly] = useState(String(store.settings.weekly.inka));
  const [rmtWeekly, setRmtWeekly] = useState(String(store.settings.weekly.rmt));
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mondayCount = listMondaysAfter(openingDate, today).length;

  function readCount(raw: string): number {
    return /^\d+$/.test(raw) ? Number(raw) : NaN;
  }

  return (
    <DialogShell title="Regla del cardex" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const settings: Settings = {
            openingDate,
            initial: { inka: readCount(inkaInitial), rmt: readCount(rmtInitial) },
            weekly: { inka: readCount(inkaWeekly), rmt: readCount(rmtWeekly) },
          };
          if ([settings.initial.inka, settings.initial.rmt, settings.weekly.inka, settings.weekly.rmt].some((n) => !Number.isInteger(n))) {
            setError("Usa números enteros en los paquetes. Cero está permitido.");
            return;
          }
          const message = onSave(settings);
          if (message) setError(message);
        }}
      >
        <p className="text-sm text-muted">
          El inventario inicial es la apertura. Los lunes posteriores se cargan solos y conservan la cantidad con la que entraron.
        </p>
        <label className="mt-4 block text-sm font-medium text-ink" htmlFor={`${baseId}-open`}>
          Fecha del inventario inicial
          <input
            id={`${baseId}-open`}
            type="date"
            required
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
            className="mt-1 h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-card px-3 text-base text-ink"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          {mondayCount === 0
            ? "Todavía no hay un lunes posterior a esa fecha."
            : `Hay ${formatQty(mondayCount)} ${mondayCount === 1 ? "lunes posterior" : "lunes posteriores"} a esa fecha.`}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NumberField id={`${baseId}-ii`} label="Inicial Inka Express" value={inkaInitial} onChange={setInkaInitial} />
          <NumberField id={`${baseId}-ri`} label="Inicial RMT" value={rmtInitial} onChange={setRmtInitial} />
          <NumberField id={`${baseId}-iw`} label="Cada lunes Inka Express" value={inkaWeekly} onChange={setInkaWeekly} />
          <NumberField id={`${baseId}-rw`} label="Cada lunes RMT" value={rmtWeekly} onChange={setRmtWeekly} />
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-line bg-card text-sm font-semibold text-ink">
            Cancelar
          </button>
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-lagoon text-sm font-semibold text-on-lagoon hover:bg-lagoon-deep">
            Guardar regla
          </button>
        </div>
      </form>
      <div className="mt-4 border-t border-line pt-4">
        {confirmReset ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmReset(false)} className="min-h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-ink">
              Volver
            </button>
            <button type="button" onClick={onReset} className="min-h-11 flex-1 rounded-xl bg-danger text-sm font-semibold text-on-danger">
              Sí, restablecer
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className="min-h-11 w-full text-sm font-semibold text-danger">
            Restablecer a 200 y 70, y borrar movimientos
          </button>
        )}
      </div>
    </DialogShell>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const n = /^\d+$/.test(value) ? Number(value) : null;
  return (
    <label className="block text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink tabular-nums"
      />
      <span className="mt-1 block text-xs font-normal text-muted tabular-nums">
        {n === null ? "Número entero" : `${formatQty(bottlesOf(n))} botellas`}
      </span>
    </label>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <DialogShell title={title} onClose={onClose}>
      <p className="text-sm text-muted">{body}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-line bg-card text-sm font-semibold text-ink">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            const message = onConfirm();
            if (message) setError(message);
          }}
          className="min-h-11 flex-1 rounded-xl bg-danger text-sm font-semibold text-on-danger"
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}

function DialogShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = panelRef.current?.querySelector<HTMLElement>("input, button, textarea, select");
    node?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-card p-5 shadow-card sm:max-w-md sm:rounded-card"
      >
        <h2 id={titleId} className="text-2xl text-ink">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
