"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Minus,
  Plus,
  Shield,
  X,
} from "lucide-react";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
import { v2MotionTokens } from "@/design-system/tokens";
import { cn } from "@/lib/utils";
import type {
  CandidateFilter,
  CandidateState,
  ImportMetadata,
  WorkspaceAccount,
  WorkspaceCategory,
} from "./types";
import { sourceTypeLabel, typeBadgeClass, typeLabel } from "./utils";

export function ReviewView({
  candidates,
  metadata,
  accounts,
  categories,
  selectedCount,
  onPatch,
  onToggleSelect,
  onSelectAll,
  onSelectSafe,
  onDeselectDuplicates,
  onConfirm,
  onReset,
}: {
  candidates: CandidateState[];
  metadata: ImportMetadata;
  accounts: WorkspaceAccount[];
  categories: WorkspaceCategory[];
  selectedCount: number;
  onPatch: (id: string, changes: Partial<CandidateState>) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (val: boolean) => void;
  onSelectSafe: () => void;
  onDeselectDuplicates: () => void;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<CandidateFilter>("all");
  const shouldReduceMotion = useReducedMotion();

  const filterCounts = useMemo(
    () => ({
      all: candidates.length,
      safe: candidates.filter((c) => c.confidence >= 0.85 && !c.possibleDuplicate && !c.warning)
        .length,
      review: candidates.filter(
        (c) => c.warning !== null || (c.confidence >= 0.65 && c.confidence < 0.85),
      ).length,
      duplicates: candidates.filter((c) => c.possibleDuplicate).length,
    }),
    [candidates],
  );

  const displayedCandidates = useMemo(() => {
    switch (activeFilter) {
      case "safe":
        return candidates.filter(
          (c) => c.confidence >= 0.85 && !c.possibleDuplicate && !c.warning,
        );
      case "review":
        return candidates.filter(
          (c) => c.warning !== null || (c.confidence >= 0.65 && c.confidence < 0.85),
        );
      case "duplicates":
        return candidates.filter((c) => c.possibleDuplicate);
      default:
        return candidates;
    }
  }, [candidates, activeFilter]);

  const selectedTotals = useMemo(
    () =>
      Object.entries(
        candidates
          .filter((c) => c.selected)
          .reduce<Record<string, number>>((totals, c) => {
            totals[c.currency] = (totals[c.currency] ?? 0) + (parseFloat(c.editAmount) || 0);
            return totals;
          }, {}),
      ).map(([currency, amount]) => ({ currency, amount })),
    [candidates],
  );

  const allSelected = candidates.length > 0 && selectedCount === candidates.length;

  return (
    <div className="space-y-4 pb-[220px] sm:pb-6">
      {metadata.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-1">
              {metadata.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-400">
                  {w}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {(metadata.aiAssisted || metadata.aiFallbackUsed) && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            metadata.aiAssisted
              ? "border-teal-400/20 bg-teal-400/[0.07]"
              : "border-amber-400/20 bg-amber-400/[0.07]",
          )}
        >
          <div className="flex items-start gap-3">
            <BrainCircuit
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                metadata.aiAssisted ? "text-teal-300" : "text-amber-300",
              )}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className={cn("text-sm font-semibold", metadata.aiAssisted ? "text-teal-300" : "text-amber-300")}>
                {metadata.aiAssisted ? "IA contextual ayudó con el mapping" : "Modo determinístico sin IA contextual"}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                {metadata.aiAssisted
                  ? metadata.aiReasoning ?? "Usamos nombres de columnas y perfiles estadísticos, no filas completas."
                  : "No se pudo usar la ayuda contextual. El preview queda editable para que revises antes de importar."}
              </p>
              {typeof metadata.mappingConfidence === "number" && (
                <p className="text-xs text-muted-foreground">
                  Confianza de estructura: {Math.round(metadata.mappingConfidence * 100)}%.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <NarrativeSummary candidates={candidates} metadata={metadata} selectedCount={selectedCount} />

      <QuickActionsBar
        filterCounts={filterCounts}
        activeFilter={activeFilter}
        onFilter={setActiveFilter}
        onSelectAll={onSelectAll}
        onSelectSafe={onSelectSafe}
        onDeselectDuplicates={onDeselectDuplicates}
        allSelected={allSelected}
        hasDuplicates={filterCounts.duplicates > 0}
      />

      {displayedCandidates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/15 p-10 text-center">
          <p className="text-sm text-muted-foreground">No hay transacciones en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedCandidates.map((c, i) => (
            <motion.div
              key={c.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(i * 0.05, 0.3),
                duration: 0.32,
                ease: v2MotionTokens.easeOut,
              }}
            >
              <CandidateCard
                candidate={c}
                accounts={accounts}
                categories={categories}
                onPatch={(changes) => onPatch(c.id, changes)}
                onToggle={() => onToggleSelect(c.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <div className="hidden sm:block">
        <ConfirmBar
          selectedCount={selectedCount}
          selectedTotals={selectedTotals}
          onConfirm={onConfirm}
          onReset={onReset}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 px-4 sm:hidden">
        <div
          className="rounded-2xl border border-border p-3 shadow-2xl"
          style={{
            background: "hsl(var(--background) / 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <ConfirmBar
            selectedCount={selectedCount}
            selectedTotals={selectedTotals}
            onConfirm={onConfirm}
            onReset={onReset}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function NarrativeSummary({
  candidates,
  metadata,
  selectedCount,
}: {
  candidates: CandidateState[];
  metadata: ImportMetadata;
  selectedCount: number;
}) {
  const total = useMemo(
    () =>
      candidates.reduce<Record<string, number>>((totals, c) => {
        totals[c.currency] = (totals[c.currency] ?? 0) + (parseFloat(c.editAmount) || 0);
        return totals;
      }, {}),
    [candidates],
  );
  const highConf = candidates.filter((c) => c.confidence >= 0.85).length;
  const medConf = candidates.filter((c) => c.confidence >= 0.65 && c.confidence < 0.85).length;
  const lowConf = candidates.filter((c) => c.confidence < 0.65).length;
  const duplicates = candidates.filter((c) => c.possibleDuplicate).length;
  return (
    <PremiumCard
      variant="default"
      className="border-teal-400/20"
      style={{
        background:
          "linear-gradient(135deg, rgba(45,212,191,0.06) 0%, rgba(255,255,255,0.02) 60%)",
      }}
    >
      <PremiumCardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-400/80">
              {sourceTypeLabel(metadata.sourceType)}
            </p>
            <div className="space-y-0.5">
              {Object.entries(total).map(([itemCurrency, amount]) => (
                <p key={itemCurrency} className="text-2xl font-bold tabular-nums text-foreground">
                  {formatImportMoney(amount, itemCurrency)}
                </p>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {candidates.length} movimiento{candidates.length !== 1 ? "s" : ""} detectado
              {candidates.length !== 1 ? "s" : ""}
            </p>
            {metadata.mixedCurrencies && (
              <p className="text-xs text-muted-foreground">
                Totales separados por moneda real. No hay suma ARS + USD.
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-right">
            <div className="flex flex-wrap justify-end gap-1.5">
              {highConf > 0 && (
                <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
                  {highConf} seguros
                </span>
              )}
              {medConf > 0 && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                  {medConf} a revisar
                </span>
              )}
              {lowConf > 0 && (
                <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                  {lowConf} dudoso{lowConf !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {duplicates > 0 && (
              <p className="text-xs text-amber-400/80">
                {duplicates} posible{duplicates !== 1 ? "s" : ""} duplicado
                {duplicates !== 1 ? "s" : ""} deseleccionado{duplicates !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {selectedCount < candidates.length && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {selectedCount} de {candidates.length} seleccionadas para importar.{" "}
            {candidates.length - selectedCount} se van a descartar.
          </p>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

function QuickActionsBar({
  filterCounts,
  activeFilter,
  onFilter,
  onSelectAll,
  onSelectSafe,
  onDeselectDuplicates,
  allSelected,
  hasDuplicates,
}: {
  filterCounts: Record<CandidateFilter, number>;
  activeFilter: CandidateFilter;
  onFilter: (f: CandidateFilter) => void;
  onSelectAll: (v: boolean) => void;
  onSelectSafe: () => void;
  onDeselectDuplicates: () => void;
  allSelected: boolean;
  hasDuplicates: boolean;
}) {
  const filters: { key: CandidateFilter; label: string }[] = [
    { key: "all", label: `Todas (${filterCounts.all})` },
    { key: "safe", label: `Seguras (${filterCounts.safe})` },
    { key: "review", label: `Revisar (${filterCounts.review})` },
    { key: "duplicates", label: `Duplicadas (${filterCounts.duplicates})` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilter(f.key)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
              activeFilter === f.key
                ? "border border-teal-400/30 bg-teal-400/15 text-teal-300"
                : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectAll(!allSelected)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/70"
        >
          {allSelected ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
        </button>

        <button
          type="button"
          onClick={onSelectSafe}
          className="flex items-center gap-1.5 rounded-xl border border-teal-400/20 bg-teal-400/[0.07] px-3 py-1.5 text-xs font-medium text-teal-300 transition hover:bg-teal-400/15"
        >
          <Shield className="h-3 w-3" />
          Solo seguras
        </button>

        {hasDuplicates && (
          <button
            type="button"
            onClick={onDeselectDuplicates}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/15"
          >
            <Copy className="h-3 w-3" />
            Excluir duplicadas
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmBar({
  selectedCount,
  selectedTotals,
  onConfirm,
  onReset,
  compact = false,
}: {
  selectedCount: number;
  selectedTotals: Array<{ currency: string; amount: number }>;
  onConfirm: () => void;
  onReset: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {selectedCount > 0 ? (
              <>
                <span className="text-teal-300">{selectedCount}</span>{" "}
                seleccionada{selectedCount !== 1 ? "s" : ""}
              </>
            ) : (
              <span className="text-muted-foreground">Ninguna seleccionada</span>
            )}
          </p>
          {selectedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrencyList(selectedTotals)}
            </p>
          )}
        </div>
        <ActionButton size="sm" disabled={selectedCount === 0} onClick={onConfirm}>
          <CircleDollarSign className="h-3.5 w-3.5" />
          Importar
          <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ActionButton className="flex-1 sm:flex-none" disabled={selectedCount === 0} onClick={onConfirm}>
        <CircleDollarSign className="h-4 w-4" />
        Importar {selectedCount} transacción{selectedCount !== 1 ? "es" : ""}
        {selectedCount > 0 && (
          <span className="ml-1 text-teal-200/70">
            · {formatCurrencyList(selectedTotals)}
          </span>
        )}
        <ArrowRight className="h-4 w-4" />
      </ActionButton>
      <ActionButton variant="glass" size="sm" onClick={onReset}>
        <X className="h-3.5 w-3.5" />
        Cancelar
      </ActionButton>
    </div>
  );
}

function CandidateCard({
  candidate: c,
  accounts,
  categories,
  onPatch,
  onToggle,
}: {
  candidate: CandidateState;
  accounts: WorkspaceAccount[];
  categories: WorkspaceCategory[];
  onPatch: (changes: Partial<CandidateState>) => void;
  onToggle: () => void;
}) {
  const expenseCategories = categories.filter((cat) =>
    c.editType === "INCOME" ? cat.type === "INCOME" : ["EXPENSE"].includes(cat.type),
  );

  return (
    <PremiumCard
      variant={c.selected ? "default" : "quiet"}
      className={cn("transition-all duration-200", !c.selected && "opacity-50")}
    >
      <PremiumCardContent className="p-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={c.selected ? "Deseleccionar" : "Seleccionar"}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
              c.selected
                ? "border-teal-400/60 bg-teal-400/20 text-teal-300"
                : "border-border bg-muted/30",
            )}
          >
            {c.selected && <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  typeBadgeClass(c.editType),
                )}
              >
                {typeLabel(c.editType)}
              </span>
              <ConfidenceBadge value={c.confidence} />
              {c.isInstallment && (
                <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  Cuota {c.installmentNumber}/{c.totalInstallments}
                </span>
              )}
              {c.isCharge && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Cargo
                </span>
              )}
              {c.isTax && (
                <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  Impuesto
                </span>
              )}
              {c.possibleDuplicate && (
                <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  <Copy className="h-2.5 w-2.5" />
                  Posible duplicado
                </span>
              )}
            </div>

            <input
              type="text"
              value={c.editDescription}
              onChange={(e) => onPatch({ editDescription: e.target.value })}
              maxLength={80}
              placeholder="Descripción"
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-base md:text-sm text-foreground placeholder-zinc-600 outline-none focus:border-teal-400/40 focus:bg-muted/60"
            />

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                {c.currency === "USD" ? "USD" : "$"}
              </span>
              <input
                type="number"
                value={c.editAmount}
                onChange={(e) => onPatch({ editAmount: e.target.value })}
                step="0.01"
                min="0.01"
                className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-12 pr-3 text-base font-bold tabular-nums text-foreground outline-none focus:border-teal-400/40 focus:bg-muted/60"
              />
            </div>

            <input
              type="date"
              value={c.editDate}
              onChange={(e) => onPatch({ editDate: e.target.value })}
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-base md:text-sm text-foreground outline-none focus:border-teal-400/40 focus:bg-muted/60 "
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cuenta
                </label>
                <select
                  value={c.editAccountId}
                  onChange={(e) => onPatch({ editAccountId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-base md:text-xs text-foreground outline-none focus:border-teal-400/40 [&>option]:bg-card"
                >
                  <option value="">Sin cuenta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Categoría
                </label>
                <select
                  value={c.editCategoryId}
                  onChange={(e) => onPatch({ editCategoryId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-base md:text-xs text-foreground outline-none focus:border-teal-400/40 [&>option]:bg-card"
                >
                  <option value="">Sin categoría</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(c.warning || (c.possibleDuplicate && c.duplicateInfo)) && (
              <div className="space-y-1">
                {c.warning && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {c.warning}
                  </span>
                )}
                {c.possibleDuplicate && c.duplicateInfo && (
                  <span className="text-xs text-muted-foreground">
                    Ya existe: {c.duplicateInfo.date} · ${" "}
                    {c.duplicateInfo.amount.toLocaleString("es-AR")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  if (pct >= 85) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
        <Shield className="h-2.5 w-2.5" />
        Alta confianza
      </span>
    );
  }
  if (pct >= 65) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        <AlertCircle className="h-2.5 w-2.5" />
        Revisar
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
      <AlertCircle className="h-2.5 w-2.5" />
      Dudoso
    </span>
  );
}

function formatImportMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyList(totals: Array<{ currency: string; amount: number }>) {
  return totals
    .map((total) => formatImportMoney(total.amount, total.currency))
    .join(" · ");
}
