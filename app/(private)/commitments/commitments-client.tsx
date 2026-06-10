"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Home,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import type { CommitmentItem, CommitmentsSummary } from "@/server/services/commitments";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function currentArgentinaMonthKey() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  return buildMonthKey(now.getFullYear(), now.getMonth() + 1);
}

// ─── Status ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OVERDUE: {
    label: "Vencido",
    icon: AlertTriangle,
    pill: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
    row: "border-l-2 border-rose-500/40",
  },
  PENDING: {
    label: "Pendiente",
    icon: Clock,
    pill: "bg-amber-400/10 text-amber-500 border border-amber-400/20",
    row: "border-l-2 border-amber-400/30",
  },
  PAID: {
    label: "Pagado",
    icon: CheckCircle2,
    pill: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    row: "border-l-2 border-emerald-500/30",
  },
} as const;

const KIND_CONFIG = {
  recurring: { icon: RefreshCw, label: "Recurrente", href: "/recurring" },
  debt: { icon: CreditCard, label: "Crédito / cuota", href: "/debts" },
  household_recurring: { icon: Home, label: "Hogar", href: "/household" },
} as const;

// ─── Components ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CommitmentItem["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none", cfg.pill)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function CommitmentRow({ item }: { item: CommitmentItem }) {
  const kindCfg = KIND_CONFIG[item.kind];
  const statusCfg = STATUS_CONFIG[item.status];
  const KindIcon = kindCfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card/60 px-4 py-3 transition-colors hover:bg-card",
        statusCfg.row,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60">
        <KindIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            "truncate text-[13px] font-medium leading-snug",
            item.status === "PAID" ? "text-muted-foreground line-through" : "text-foreground",
          )}>
            {item.name}
          </p>
          <StatusPill status={item.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {item.category && (
            <span className="truncate text-[11px] text-muted-foreground/70">
              {item.category.name}
            </span>
          )}
          {item.dueDay && (
            <span className="shrink-0 text-[11px] text-muted-foreground/50">
              vence día {item.dueDay}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-muted-foreground/40 capitalize">
            {kindCfg.label}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn(
          "text-[13px] font-semibold tabular-nums",
          item.status === "PAID" ? "text-muted-foreground" : "text-foreground",
        )}>
          <SensitiveAmount value={formatMoney(item.amount, item.currency)} />
        </p>
        {item.debtOutstandingAmount !== undefined && item.debtOutstandingAmount !== item.amount && (
          <p className="text-[11px] text-muted-foreground/50">
            saldo <SensitiveAmount value={formatMoney(item.debtOutstandingAmount, item.currency)} />
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryBar({ summary }: { summary: CommitmentsSummary }) {
  const tiles = [
    {
      key: "overdue" as const,
      label: "Vencidos",
      count: summary.overdueCount,
      amount: summary.overdueAmount,
      color: "text-rose-500",
      bg: "bg-rose-500/8",
    },
    {
      key: "pending" as const,
      label: "Pendientes",
      count: summary.pendingCount,
      amount: summary.pendingAmount,
      color: "text-amber-500",
      bg: "bg-amber-400/8",
    },
    {
      key: "paid" as const,
      label: "Pagados",
      count: summary.paidCount,
      amount: summary.paidAmount,
      color: "text-emerald-500",
      bg: "bg-emerald-500/8",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.key} className={cn("rounded-2xl p-3 text-center", t.bg)}>
          <p className={cn("text-[22px] font-bold leading-none tabular-nums", t.color)}>
            {t.count}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.label}
          </p>
          {t.amount > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground/70 tabular-nums">
              <SensitiveAmount value={formatMoney(t.amount)} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function MonthNav({
  monthKey,
  onPrev,
  onNext,
  isCurrent,
}: {
  monthKey: string;
  onPrev: () => void;
  onNext: () => void;
  isCurrent: boolean;
}) {
  const { year, month } = parseMonthKey(monthKey);
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="text-center">
        <p className="text-[15px] font-semibold text-foreground">{MONTH_NAMES[month - 1]}</p>
        <p className="text-[12px] text-muted-foreground">{year}</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isCurrent}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Main client ─────────────────────────────────────────────────────────────

type Props = { householdId: string };

export function CommitmentsClient({ householdId }: Props) {
  const [monthKey, setMonthKey] = useState(currentArgentinaMonthKey);
  const [items, setItems] = useState<CommitmentItem[] | null>(null);
  const [summary, setSummary] = useState<CommitmentsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonthKey = currentArgentinaMonthKey();

  const fetchData = useCallback(async (mk: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commitments?householdId=${encodeURIComponent(householdId)}&monthKey=${mk}`,
      );
      if (!res.ok) throw new Error("Error cargando compromisos");
      const json = await res.json();
      setItems(json.data?.items ?? []);
      setSummary(json.data?.summary ?? null);
    } catch {
      setError("No se pudieron cargar los compromisos.");
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    fetchData(monthKey);
  }, [fetchData, monthKey]);

  function goPrev() {
    const { year, month } = parseMonthKey(monthKey);
    setMonthKey(month === 1 ? buildMonthKey(year - 1, 12) : buildMonthKey(year, month - 1));
  }

  function goNext() {
    if (monthKey >= currentMonthKey) return;
    const { year, month } = parseMonthKey(monthKey);
    setMonthKey(month === 12 ? buildMonthKey(year + 1, 1) : buildMonthKey(year, month + 1));
  }

  const overdueItems = items?.filter((i) => i.status === "OVERDUE") ?? [];
  const pendingItems = items?.filter((i) => i.status === "PENDING") ?? [];
  const paidItems = items?.filter((i) => i.status === "PAID") ?? [];

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <PremiumCard>
        <PremiumCardContent className="pt-4">
          <MonthNav
            monthKey={monthKey}
            onPrev={goPrev}
            onNext={goNext}
            isCurrent={monthKey >= currentMonthKey}
          />
        </PremiumCardContent>
      </PremiumCard>

      {/* Summary bar */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : summary ? (
        <SummaryBar summary={summary} />
      ) : null}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <PremiumCard>
          <PremiumCardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
            </div>
          </PremiumCardContent>
        </PremiumCard>
      ) : items && items.length === 0 ? (
        <PremiumCard>
          <PremiumCardContent>
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-[14px] font-medium text-muted-foreground">Sin compromisos este mes</p>
              <p className="mt-1 text-[12px] text-muted-foreground/60">
                No hay vencimientos registrados para este período.
              </p>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      ) : (
        <div className="space-y-4">
          {overdueItems.length > 0 && (
            <CommitmentGroup title="Vencidos" items={overdueItems} tone="rose" />
          )}
          {pendingItems.length > 0 && (
            <CommitmentGroup title="Pendientes" items={pendingItems} tone="amber" />
          )}
          {paidItems.length > 0 && (
            <CommitmentGroup title="Pagados" items={paidItems} tone="emerald" />
          )}
        </div>
      )}

      {/* Management links */}
      {!isLoading && (
        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="text-[13px]">Gestionar</PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent>
            <div className="space-y-1">
              <ManageLink
                href="/recurring"
                icon={RefreshCw}
                label="Gastos recurrentes"
                description="Suscripciones, servicios y pagos fijos"
              />
              <ManageLink
                href="/debts"
                icon={CreditCard}
                label="Créditos y cuotas"
                description="Deudas activas y pagos mínimos"
              />
            </div>
          </PremiumCardContent>
        </PremiumCard>
      )}
    </div>
  );
}

function CommitmentGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: CommitmentItem[];
  tone: "rose" | "amber" | "emerald";
}) {
  const toneLabel = {
    rose: "text-rose-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  }[tone];

  return (
    <div>
      <p className={cn("mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest", toneLabel)}>
        {title} · {items.length}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <CommitmentRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ManageLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: typeof RefreshCw;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-12 items-center gap-3 rounded-2xl px-3 text-[13px] font-medium text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 truncate text-[11px] text-muted-foreground/50">{description}</span>
      <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
    </Link>
  );
}
