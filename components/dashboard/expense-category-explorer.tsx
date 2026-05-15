"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, ReceiptText, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
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
          ? "border-teal-300/25 bg-teal-300/[0.08] shadow-[0_18px_55px_rgba(45,212,191,0.08)]"
          : "border-white/10 bg-zinc-950/55 hover:border-white/20 hover:bg-zinc-900/75"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="h-10 w-1.5 shrink-0 rounded-full shadow-[0_0_24px_currentColor]"
            style={{ backgroundColor: item.color, color: item.color }}
          />
          <span className="min-w-0">
            <span className={`block truncate text-sm font-semibold ${isActive ? "text-white" : "text-zinc-200"}`}>
              {item.name}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">{percentage}% del gasto del mes</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-white">
            {formatMoney(item.value)}
          </span>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isActive ? "bg-teal-300/15 text-teal-100" : "bg-white/[0.06] text-zinc-500"
            }`}
          >
            {isActive ? "Cerrar" : "Ver detalle"}
          </span>
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
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
      className={`rounded-[var(--v2-radius-xl)] border border-white/[0.14] bg-zinc-950 p-4 ${
        elevated ? "shadow-[0_24px_80px_rgba(0,0,0,0.42)]" : ""
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-zinc-400 transition hover:bg-white/[0.14] hover:text-white"
                aria-label="Volver a categorías"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color ?? "hsl(var(--v2-brand))" }}
            />
            <p className="text-[11px] font-semibold uppercase text-zinc-500">
              Movimientos de categoría
            </p>
          </div>
          <h3 className="truncate text-lg font-semibold text-white">{category.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {category.items.length} movimiento{category.items.length !== 1 ? "s" : ""} explican este total.
          </p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums text-white">
          {formatMoney(category.total)}
        </p>
      </div>

      <div className="space-y-2 pr-1 xl:max-h-[360px] xl:overflow-y-auto">
        {category.items.map((item) => (
          <Link
            key={item.id}
            href={`/transactions?categoryId=${category.id}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2.5 transition hover:border-white/20 hover:bg-zinc-800"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">
                {item.description ?? "Sin descripción"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                {item.account.name} · {formatDate(item.occurredAt)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-rose-300">
                -{formatMoney(item.amount, item.currency as "ARS" | "USD")}
              </span>
              <ExternalLink
                className="h-3.5 w-3.5 text-zinc-600 transition group-hover:text-zinc-300"
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
              <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-semibold text-teal-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Mapa de consumo
              </div>
              <PremiumCardTitle>Por dónde va el dinero</PremiumCardTitle>
              <PremiumCardDescription>
                Qué se llevó más y qué movimientos explican cada parte.
              </PremiumCardDescription>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Total leído</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                {formatMoney(totalExpenses)}
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
                <div className="rounded-[var(--v2-radius-xl)] border border-white/10 bg-zinc-950/70 p-4 shadow-inner shadow-black/20">
                  <ExpenseCategoryChart
                    data={expensesByCategory}
                    activeCategoryId={selectedExpenseCategoryId ?? undefined}
                    onSelectCategory={onSelectCategory}
                  />
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
