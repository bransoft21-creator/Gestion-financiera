"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  HelpCircle,
  Loader2,
  Repeat,
  ShoppingCart,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { trackProductEvent } from "@/lib/observability/client";
import type { ExpenseTypeDetailTransaction } from "@/app/api/dashboard/expense-type-detail/route";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type DrilldownGroup = "fixed" | "variable" | "extraordinary" | "unclassified";

export interface ExpenseTypeDrilldownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  group: DrilldownGroup;
  total: number;
  pct: number;
  year: number;
  month: number;
}

/* ── Config per group ─────────────────────────────────────────────────────── */

const GROUP_CONFIG = {
  fixed: {
    label: "Gastos fijos",
    icon: Repeat,
    iconBg: "bg-sky-500/15 text-sky-400",
    accent: "text-sky-400",
    barColor: "#38bdf8",
    explanation: "Pagos recurrentes como alquiler, servicios y cuotas.",
    apiType: "FIXED",
  },
  variable: {
    label: "Gastos variables",
    icon: ShoppingCart,
    iconBg: "bg-amber-500/15 text-amber-400",
    accent: "text-amber-400",
    barColor: "#fbbf24",
    explanation: "Compras y consumo del día a día — supermercado, transporte, salidas.",
    apiType: "VARIABLE",
  },
  extraordinary: {
    label: "Gastos extraordinarios",
    icon: Zap,
    iconBg: "bg-teal-500/10 text-teal-500",
    accent: "text-teal-400",
    barColor: "#5eead4",
    explanation: "Gastos puntuales o imprevistos que no se repiten seguido.",
    apiType: "EXTRAORDINARY",
  },
  unclassified: {
    label: "Sin clasificar",
    icon: HelpCircle,
    iconBg: "bg-secondary text-muted-foreground",
    accent: "text-muted-foreground",
    barColor: "#6b7280",
    explanation: "No pudimos clasificar estos movimientos automáticamente.",
    apiType: "UNCLASSIFIED",
  },
} as const satisfies Record<DrilldownGroup, {
  label: string;
  icon: React.ElementType;
  iconBg: string;
  accent: string;
  barColor: string;
  explanation: string;
  apiType: string;
}>;

const RECLASSIFY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "FIXED", label: "Fijo" },
  { value: "VARIABLE", label: "Variable" },
  { value: "EXTRAORDINARY", label: "Extraordinario" },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatMoney(amount: string, currency: string) {
  const n = parseFloat(amount);
  const formatted = n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return currency === "USD" ? `USD ${formatted}` : `$ ${formatted}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/* ── Transaction row ─────────────────────────────────────────────────────── */

function TransactionRow({
  tx,
  group,
  onReclassified,
}: {
  tx: ExpenseTypeDetailTransaction;
  group: DrilldownGroup;
  onReclassified: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const options = RECLASSIFY_OPTIONS.filter((o) => o.value !== GROUP_CONFIG[group].apiType);

  async function handleReclassify(newType: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: tx.householdId, expenseType: newType }),
      });
      if (!r.ok) throw new Error();
      trackProductEvent("distribution_transaction_reclassified", { expenseGroup: group }, "dashboard");
      toast.success("Clasificación actualizada");
      onReclassified(tx.id);
    } catch {
      toast.error("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 sm:flex-nowrap">
      {/* Date */}
      <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatDate(tx.occurredAt)}
      </span>

      {/* Description + category */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {tx.description ?? <span className="italic text-muted-foreground">Sin descripción</span>}
        </p>
        {tx.categoryName && (
          <p className="truncate text-[11px] text-muted-foreground">{tx.categoryName}</p>
        )}
      </div>

      {/* Amount */}
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        <SensitiveAmount value={formatMoney(tx.amount, tx.currency)} />
      </span>

      {/* Reclassify select */}
      <div className="w-full shrink-0 sm:w-auto">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) void handleReclassify(e.target.value); }}
            className="w-full rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 sm:w-auto [&>option]:bg-card"
            aria-label="Cambiar clasificación"
          >
            <option value="">Mover a…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

/* ── Main sheet ──────────────────────────────────────────────────────────── */

export function ExpenseTypeDrilldownSheet({
  isOpen,
  onClose,
  group,
  total,
  pct,
  year,
  month,
}: ExpenseTypeDrilldownSheetProps) {
  const isMounted = useClientMounted();
  useLockBodyScroll(isOpen);
  const router = useRouter();
  const didTrack = useRef(false);

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [transactions, setTransactions] = useState<ExpenseTypeDetailTransaction[]>([]);

  const config = GROUP_CONFIG[group];
  const Icon = config.icon;
  const isUnclassified = group === "unclassified";

  // Track open + fetch on open
  useEffect(() => {
    if (!isOpen) {
      didTrack.current = false;
      return;
    }

    if (!didTrack.current) {
      didTrack.current = true;
      trackProductEvent("distribution_group_opened", { expenseGroup: group }, "dashboard");
    }

    // Wrap in async fn so setState calls are indirect (avoids react-hooks/set-state-in-effect)
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setTransactions([]);
      try {
        const params = new URLSearchParams({ year: String(year), month: String(month), expenseGroup: config.apiType });
        const r = await fetch(`/api/dashboard/expense-type-detail?${params.toString()}`);
        const payload = (await r.json()) as { data?: { transactions: ExpenseTypeDetailTransaction[] } };
        if (!cancelled) {
          setTransactions(payload.data?.transactions ?? []);
          setStatus("done");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [isOpen, group, year, month, config.apiType]);

  function handleDataQualityClick() {
    trackProductEvent("distribution_data_quality_clicked", { expenseGroup: group }, "dashboard");
    onClose();
    router.push("/settings/data-quality");
  }

  function handleTransactionReclassified(id: string) {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }

  if (!isMounted || !isOpen) return null;

  const formattedTotal = total.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const count = status === "done" ? transactions.length : null;

  const content = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[125] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={config.label}
        className="fixed inset-x-0 bottom-0 z-[130] flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-border bg-card/[0.98] shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]"
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-2">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", config.iconBg)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{config.label}</p>
              <p className="text-[11px] text-muted-foreground">{config.explanation}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted/50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="mx-5 mb-4 shrink-0 flex items-center gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
            <p className={cn("text-xl font-extrabold tabular-nums", config.accent)}>
              <SensitiveAmount value={formattedTotal} />
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Del gasto</p>
            <p className="text-xl font-extrabold tabular-nums text-foreground">{pct}%</p>
          </div>
          {count !== null && (
            <>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Movimientos</p>
                <p className="text-xl font-extrabold tabular-nums text-foreground">{count}</p>
              </div>
            </>
          )}
        </div>

        <div className="h-px shrink-0 bg-border" />

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {status === "loading" && (
            <div className="space-y-3 px-5 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-12 rounded" />
                  <Skeleton className="h-3 flex-1 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No se pudieron cargar los movimientos.
            </p>
          )}

          {status === "done" && transactions.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay movimientos en este grupo este mes.
            </p>
          )}

          {status === "done" && transactions.length > 0 && (
            <div className="divide-y divide-border/50 pb-2">
              <p className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Movimientos · Tocá &ldquo;Mover a…&rdquo; para reclasificar
              </p>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  group={group}
                  onReclassified={handleTransactionReclassified}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {isUnclassified && status === "done" && transactions.length > 0 && (
          <>
            <div className="h-px shrink-0 bg-border" />
            <div className="shrink-0 px-5 py-4">
              <div className="mb-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Clasificar estos gastos mejora tus proyecciones y análisis.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Usá Calidad de datos para organizarlos rápido.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDataQualityClick}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 active:scale-[0.98]"
              >
                Revisar en Calidad de datos
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {!isUnclassified && (
          <div className="h-px shrink-0 bg-border" />
        )}
        {!isUnclassified && (
          <div className="shrink-0 px-5 py-4">
            <p className="text-center text-xs text-muted-foreground">
              Los cambios se aplican al instante y actualizan tu dashboard.
            </p>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
