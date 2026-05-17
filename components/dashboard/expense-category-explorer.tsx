"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, ReceiptText, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { ChartErrorBoundary } from "@/components/app/chart-error-boundary";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import {
  ExpenseCategoryChart,
  type ExpenseCategoryChartItem,
} from "@/components/dashboard/expense-category-chart";
import { formatMoney, formatDate } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

function ExpenseCategoryOption({
  item,
  totalExpenses,
  isActive,
  onClick,
}: {
  item: ExpenseCategoryChartItem;
  totalExpenses: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const percentage = totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;

  return (
    <button
      type="button"
      className={`group w-full rounded-2xl border p-3 text-left transition ${
        isActive
          ? "border-primary/25 bg-primary/[0.08] shadow-sm"
          : "border-border bg-muted/20 hover:border-border hover:bg-muted/40"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="h-10 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="min-w-0">
            <span className={`block truncate text-sm font-semibold ${isActive ? "text-foreground" : "text-foreground"}`}>
              {item.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{percentage}% del gasto del mes</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-foreground">
            <SensitiveAmount value={formatMoney(item.value)} />
          </span>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isActive ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"
            }`}
          >
            {isActive ? "Cerrar" : "Ver detalle"}
          </span>
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: item.color }}
        />
      </div>
    </button>
  );
}

function ExpenseCategoryDetailPanel({
  category,
  color,
  elevated = false,
  onClose,
}: {
  category: DashboardSummary["expenseCategoryDetails"][number];
  color?: string;
  elevated?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={`rounded-[var(--v2-radius-xl)] border border-border bg-card p-4 ${
        elevated ? "shadow-lg" : ""
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Volver a categorías"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color ?? "hsl(var(--v2-brand))" }}
            />
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Movimientos de categoría
            </p>
          </div>
          <h3 className="truncate text-lg font-semibold text-foreground">{category.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {category.items.length} movimiento{category.items.length !== 1 ? "s" : ""} explican este total.
          </p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
          <SensitiveAmount value={formatMoney(category.total)} />
        </p>
      </div>

      <div className="space-y-1.5 pr-1 xl:max-h-[360px] xl:overflow-y-auto">
        {category.items.map((item) => (
          <Link
            key={item.id}
            href={`/transactions?categoryId=${category.id}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 px-3 py-2.5 transition hover:border-border hover:bg-muted/40"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {item.description ?? "Sin descripción"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {item.account.name} · {formatDate(item.occurredAt)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-rose-400">
                <SensitiveAmount value={`-${formatMoney(item.amount, item.currency as "ARS" | "USD")}`} />
              </span>
              <ExternalLink
                className="h-3.5 w-3.5 text-muted-foreground/50 transition group-hover:text-muted-foreground"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ExpenseCategoryExplorer({
  expensesByCategory,
  selectedExpenseCategory,
  selectedExpenseCategoryId,
  totalExpenses,
  onSelectCategory,
}: {
  expensesByCategory: ExpenseCategoryChartItem[];
  selectedExpenseCategory?: DashboardSummary["expenseCategoryDetails"][number];
  selectedExpenseCategoryId: string | null;
  totalExpenses: number;
  onSelectCategory: (categoryId: string) => void;
}) {
  const selectedChartItem = expensesByCategory.find((item) => item.id === selectedExpenseCategoryId);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedExpenseCategoryId) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedExpenseCategoryId]);

  return (
    <div ref={cardRef} className="scroll-mt-4">
      <PremiumCard className="overflow-hidden">
        <PremiumCardHeader>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Mapa de consumo
              </div>
              <PremiumCardTitle>Por dónde va el dinero</PremiumCardTitle>
              <PremiumCardDescription>
                Qué se llevó más y qué movimientos explican cada parte.
              </PremiumCardDescription>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total leído</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                <SensitiveAmount value={formatMoney(totalExpenses)} />
              </p>
            </div>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent>
          {expensesByCategory.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="El mes todavía está en blanco"
              description="Tu mapa de consumo empieza a construirse cuando registrás el primer gasto."
            />
          ) : (
            <div className="mx-auto grid w-full max-w-[940px] gap-5 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)] xl:items-start">
              <div className="min-w-0 space-y-4">
                <div className="rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 p-4">
                  <ChartErrorBoundary label="No se pudo renderizar el mapa de categorías">
                    <ExpenseCategoryChart
                      data={expensesByCategory}
                      activeCategoryId={selectedExpenseCategoryId ?? undefined}
                      onSelectCategory={onSelectCategory}
                    />
                  </ChartErrorBoundary>
                </div>

                {/* Mobile: swap entre lista y detalle */}
                <div className="xl:hidden">
                  {selectedExpenseCategoryId && selectedExpenseCategory ? (
                    <ExpenseCategoryDetailPanel
                      category={selectedExpenseCategory}
                      color={selectedChartItem?.color}
                      onClose={() => onSelectCategory(selectedExpenseCategoryId)}
                    />
                  ) : (
                    <div className="grid gap-2">
                      {expensesByCategory.map((item) => (
                        <ExpenseCategoryOption
                          key={item.id}
                          item={item}
                          totalExpenses={totalExpenses}
                          isActive={false}
                          onClick={() => onSelectCategory(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop: siempre muestra la lista */}
                <div className="hidden xl:grid xl:gap-2">
                  {expensesByCategory.map((item) => (
                    <ExpenseCategoryOption
                      key={item.id}
                      item={item}
                      totalExpenses={totalExpenses}
                      isActive={selectedExpenseCategoryId === item.id}
                      onClick={() => onSelectCategory(item.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="hidden xl:block">
                {selectedExpenseCategory ? (
                  <ExpenseCategoryDetailPanel
                    category={selectedExpenseCategory}
                    color={selectedChartItem?.color}
                    elevated
                  />
                ) : null}
              </div>
            </div>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}
