"use client";

import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CalendarDays,
  ChevronRight,
  Download,
  Home,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { transactionTypeLabels } from "./constants";
import type { FeedSummary, TransactionItem, TransactionType } from "./types";
import {
  formatDate,
  formatMoney,
  formatMoneyBalance,
  getDisplayAmount,
  getSignedAmount,
  getTransactionTone,
  groupTransactionsByDate,
} from "./utils";

const transactionIcons = {
  INCOME: ArrowUpCircle,
  EXPENSE: ArrowDownCircle,
  TRANSFER: ArrowRightLeft,
  ADJUSTMENT: ArrowDownCircle,
  DEBT_PAYMENT: ArrowDownCircle,
  GOAL_CONTRIBUTION: ArrowDownCircle,
  INVESTMENT: ArrowDownCircle,
} satisfies Record<TransactionType, typeof ArrowDownCircle>;

export function TransactionList({
  transactions,
  isLoading,
  search,
  totalAmount,
  feedSummary,
  activeFilterCount,
  groupedTransactions,
  collapsedGroups,
  deletingTransactionId,
  hasMore,
  isLoadingMore,
  onCollapseAll,
  onExpandAll,
  onToggleGroup,
  onEdit,
  onDelete,
  onLoadMore,
  onExportCsv,
  onNew,
}: {
  transactions: TransactionItem[];
  isLoading: boolean;
  search: string;
  totalAmount: number;
  feedSummary: FeedSummary;
  activeFilterCount: number;
  groupedTransactions: ReturnType<typeof groupTransactionsByDate>;
  collapsedGroups: Set<string>;
  deletingTransactionId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onToggleGroup: (label: string) => void;
  onEdit: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
  onLoadMore: () => void;
  onExportCsv: () => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <TransactionFeedBriefing summary={feedSummary} totalAmount={totalAmount} activeFilterCount={activeFilterCount} />

      <PremiumCard data-tutorial="transactions-feed" className="overflow-hidden border-border/80">
        <PremiumCardHeader className="border-b border-border/70 bg-muted/[0.08]">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <PremiumCardTitle>Feed de movimientos</PremiumCardTitle>
              <PremiumCardDescription>
                {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""} ·{" "}
                <SensitiveAmount
                  value={`${totalAmount >= 0 ? "+" : ""}${formatMoneyBalance(totalAmount)}`}
                  className={totalAmount >= 0 ? "text-emerald-400" : "text-rose-400"}
                />
              </PremiumCardDescription>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={onExportCsv}
                disabled={transactions.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
              <Button type="button" size="sm" className="w-full sm:w-auto" onClick={onNew}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nueva
              </Button>
            </div>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent className="p-3 pt-3 sm:p-4 sm:pt-4">
          {isLoading ? (
            <TransactionListSkeleton />
          ) : transactions.length === 0 ? (
            <TransactionsEmptyState search={search} onNew={onNew} />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/[0.08] px-2 py-1.5">
                <p className="pl-2 text-[11px] font-medium text-muted-foreground">
                  Agrupado por fecha
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={onCollapseAll}
                >
                  Colapsar días
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={onExpandAll}
                >
                  Ver todos
                </Button>
              </div>
              {groupedTransactions.map((group) => (
                <TransactionGroup
                  key={group.label}
                  group={group}
                  isCollapsed={collapsedGroups.has(group.label)}
                  deletingTransactionId={deletingTransactionId}
                  onToggle={() => onToggleGroup(group.label)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingMore}
                    onClick={onLoadMore}
                  >
                    {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {isLoadingMore ? "Cargando..." : "Cargar más"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}

function TransactionListSkeleton() {
  return (
    <div className="space-y-3 rounded-[1.35rem] border border-border/50 bg-background/40 p-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border/40 bg-muted/20 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20 shrink-0" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function TransactionsEmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-muted/[0.10] p-7 text-center sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background/80 text-muted-foreground shadow-sm">
        <ReceiptText className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{search ? "Sin resultados claros" : "Todavía no hay movimientos"}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {search
          ? "Probá con otra palabra o limpiá filtros para volver al feed completo."
          : "Registrá el primer movimiento o usá Smart Import para que el feed empiece a mostrar ritmo, categorías y cuentas."}
      </p>
      {!search ? (
        <Button type="button" className="mt-5 inline-flex" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar primera transacción
        </Button>
      ) : null}
    </div>
  );
}

function TransactionFeedBriefing({
  summary,
  totalAmount,
  activeFilterCount,
}: {
  summary: FeedSummary;
  totalAmount: number;
  activeFilterCount: number;
}) {
  const balanceTone = totalAmount >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <PremiumCard variant="raised" className="overflow-hidden border-border/80 bg-muted/[0.06] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-primary/20 bg-primary/10 text-primary">Money feed</Badge>
            {activeFilterCount > 0 && (
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">{activeFilterCount} filtros activos</Badge>
            )}
          </div>
          <h2 className="text-balance text-lg font-semibold leading-tight text-foreground sm:text-xl">
            {summary.count === 0 ? "Todavía no hay movimientos para leer." : "Así se movió tu dinero."}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {summary.count === 0
              ? "Cuando registres movimientos, esta vista va a mostrar el pulso real del mes."
              : (
                  <>
                    {summary.count} movimientos cargados. Entraron{" "}
                    <SensitiveAmount value={formatMoneyBalance(summary.income)} />
                    {" "}y salieron <SensitiveAmount value={formatMoneyBalance(summary.expenses)} />.
                  </>
                )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
          <BriefingMetric label="Balance" value={`${totalAmount >= 0 ? "+" : ""}${formatMoneyBalance(totalAmount)}`} className={balanceTone} />
          <BriefingMetric label="Entró" value={formatMoneyBalance(summary.income)} className="text-emerald-400" />
          <BriefingMetric label="Salió" value={formatMoneyBalance(summary.expenses)} className="text-rose-400" />
        </div>
      </div>
    </PremiumCard>
  );
}

function BriefingMetric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/70 bg-background/55 p-3 shadow-sm">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-xs font-semibold tabular-nums leading-tight sm:text-sm ${className ?? "text-foreground"}`}>
        <SensitiveAmount value={value} />
      </p>
    </div>
  );
}

function TransactionGroup({
  group,
  isCollapsed,
  deletingTransactionId,
  onToggle,
  onEdit,
  onDelete,
}: {
  group: ReturnType<typeof groupTransactionsByDate>[number];
  isCollapsed: boolean;
  deletingTransactionId: string | null;
  onToggle: () => void;
  onEdit: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
}) {
  return (
    <section className="space-y-2.5">
      <button
        type="button"
        className="sticky top-2 z-10 flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/95 px-3 py-2.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition duration-150 hover:bg-muted/35"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2">
          <ChevronRight className={`h-3.5 w-3.5 transition ${isCollapsed ? "" : "rotate-90"}`} aria-hidden="true" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" aria-hidden="true" />
          {group.label}
        </span>
        <span className="rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 text-[10px] tabular-nums">
          {group.transactions.length}
        </span>
      </button>
      {!isCollapsed ? (
        <div className="space-y-2 rounded-[1.35rem] border border-border/45 bg-background/35 p-1.5">
          {group.transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              isDeleting={deletingTransactionId === transaction.id}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TransactionCard({
  transaction,
  isDeleting,
  onEdit,
  onDelete,
}: {
  transaction: TransactionItem;
  isDeleting: boolean;
  onEdit: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
}) {
  const Icon = transactionIcons[transaction.type];
  const tone = getTransactionTone(transaction.type);
  const signedAmount = getSignedAmount(transaction);
  const displayAmount = getDisplayAmount(transaction);
  const isTransfer = transaction.type === "TRANSFER";

  return (
    <article
      className="group min-w-0 cursor-pointer overflow-hidden rounded-[1.15rem] border border-transparent bg-muted/[0.18] px-3.5 py-3.5 transition duration-150 hover:border-border/70 hover:bg-muted/40 active:scale-[0.995] sm:px-4"
      role="button"
      tabIndex={0}
      onClick={() => onEdit(transaction)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(transaction);
        }
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 text-foreground">{transaction.description ?? "Sin descripción"}</p>
              <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
                {transaction.type === "TRANSFER"
                  ? `${transaction.account.name}${transaction.transferAccount ? ` → ${transaction.transferAccount.name}` : ""}`
                  : `${transaction.category?.name ?? "Sin categoría"} · ${transaction.account.name}`}
              </p>
            </div>
            <div className="max-w-[44%] shrink-0 text-right sm:min-w-[108px]">
              <p className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold leading-5 sm:text-[15px] ${tone.amount}`}>
                <SensitiveAmount
                  value={`${isTransfer ? "" : signedAmount > 0 ? "+" : signedAmount < 0 ? "-" : ""}${formatMoney(isTransfer ? displayAmount : Math.abs(signedAmount), transaction.currency)}`}
                />
              </p>
              <p className="text-[10px] font-medium text-muted-foreground">{transaction.currency}</p>
            </div>
          </div>

          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge className={`h-5 shrink-0 border-0 px-2 text-[11px] ${tone.badge}`}>{transactionTypeLabels[transaction.type]}</Badge>
            {transaction.status === "PENDING" && (
              <Badge className="h-5 shrink-0 border-amber-500/30 bg-amber-500/10 px-2 text-[11px] text-amber-400">Pendiente</Badge>
            )}
            {transaction.status === "CANCELED" && (
              <Badge className="h-5 shrink-0 border-border bg-secondary px-2 text-[11px] text-muted-foreground line-through">Cancelada</Badge>
            )}
            {transaction.sharedTransaction ? (
              <Badge className="h-5 shrink-0 border-teal-500/20 bg-teal-500/10 px-2 text-[11px] text-teal-500">
                <Home className="mr-1 h-3 w-3" aria-hidden="true" />
                {transaction.sharedTransaction.household.name}
              </Badge>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full border border-border/50 bg-background/55 px-2 py-1 text-[11px] leading-none text-muted-foreground">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {formatDate(transaction.occurredAt)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(transaction);
          }}
          disabled={isDeleting}
          aria-label="Eliminar transacción"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </article>
  );
}
