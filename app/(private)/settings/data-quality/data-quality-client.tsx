"use client";

import { useState } from "react";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  FolderTree,
  Lightbulb,
  Loader2,
  Merge,
  Store,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import { ActionButton } from "@/components/ui-v2/action-button";
import { trackProductEvent } from "@/lib/observability/client";
import type {
  FrequentDescription,
  QualitySignals,
  SimilarCategoryPair,
  SimilarMerchantGroup,
  UncategorizedTransaction,
  UnusedCategory,
} from "@/server/services/data-quality";

type WorkspaceCategory = { id: string; name: string; type: string };

type Tab = "uncategorized" | "frequent" | "similar" | "unused" | "merchants";

const CAT_TYPE_LABELS: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  DEBT: "Deuda",
  GOAL: "Meta",
  INVESTMENT: "Inversión",
  ADJUSTMENT: "Ajuste",
};

function formatAmount(amount: string, currency: string) {
  const n = parseFloat(amount);
  const formatted = n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return currency === "USD" ? `USD ${formatted}` : `$ ${formatted}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function categoriesForType(categories: WorkspaceCategory[], type: string) {
  if (type === "INCOME") return categories.filter((c) => c.type === "INCOME");
  if (type === "EXPENSE") return categories.filter((c) => c.type === "EXPENSE");
  return categories.filter((c) => ["INCOME", "EXPENSE"].includes(c.type));
}

// ── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({
  count,
  label,
  accent,
  onClick,
  active,
}: {
  count: number;
  label: string;
  accent: "amber" | "teal" | "blue" | "muted";
  onClick: () => void;
  active: boolean;
}) {
  const accentClass = {
    amber: "text-amber-400",
    teal: "text-primary",
    blue: "text-sky-400",
    muted: "text-muted-foreground",
  }[accent];

  const borderClass = active ? "border-primary/30" : "border-border";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-150 hover:bg-muted/40 active:scale-[0.98]",
        borderClass,
        active ? "bg-muted/30" : "bg-card",
      )}
    >
      <p className={cn("text-2xl font-bold tabular-nums", accentClass)}>{count}</p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{label}</p>
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyCheck({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/30 text-primary">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  householdId: string;
  initialSignals: QualitySignals;
  initialUncategorized: UncategorizedTransaction[];
  initialFrequent: FrequentDescription[];
  initialSimilar: SimilarCategoryPair[];
  initialUnused: UnusedCategory[];
  initialMerchants: SimilarMerchantGroup[];
  categories: WorkspaceCategory[];
};

export function DataQualityClient({
  householdId,
  initialSignals,
  initialUncategorized,
  initialFrequent,
  initialSimilar,
  initialUnused,
  initialMerchants,
  categories,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("uncategorized");
  const [signals, setSignals] = useState(initialSignals);
  const [merchantRows] = useState(initialMerchants);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "merchants") {
      trackProductEvent("merchant_group_viewed", { merchantCount: merchantRows.length }, "analytics");
    }
  }

  // Uncategorized state
  const [uncatRows, setUncatRows] = useState(initialUncategorized);
  const [uncatSaving, setUncatSaving] = useState<string | null>(null);
  const [uncatSelected, setUncatSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Frequent state
  const [freqRows, setFreqRows] = useState(initialFrequent);
  const [freqCategoryId, setFreqCategoryId] = useState<Record<string, string>>({});
  const [freqApplying, setFreqApplying] = useState<string | null>(null);

  // Similar state
  const [simRows, setSimRows] = useState(initialSimilar);
  const [simMerging, setSimMerging] = useState<string | null>(null);

  // Unused state
  const [unusedRows, setUnusedRows] = useState(initialUnused);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSingleCategorize(transactionId: string, categoryId: string) {
    if (!categoryId) return;
    setUncatSaving(transactionId);
    try {
      const r = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, categoryId }),
      });
      if (!r.ok) throw new Error();
      setUncatRows((rows) => rows.filter((row) => row.id !== transactionId));
      setUncatSelected((s) => { const ns = new Set(s); ns.delete(transactionId); return ns; });
      setSignals((s) => ({ ...s, uncategorizedCount: Math.max(0, s.uncategorizedCount - 1) }));
      toast.success("Categoría asignada");
    } catch {
      toast.error("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setUncatSaving(null);
    }
  }

  async function handleBulkCategorize() {
    if (!bulkCategoryId || uncatSelected.size === 0) return;
    setBulkSaving(true);
    try {
      const r = await fetch("/api/transactions/bulk-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, transactionIds: Array.from(uncatSelected), categoryId: bulkCategoryId }),
      });
      if (!r.ok) throw new Error();
      const json = await r.json() as { data?: { updated?: number } };
      const count = (json.data?.updated ?? 0);
      setUncatRows((rows) => rows.filter((row) => !uncatSelected.has(row.id)));
      setSignals((s) => ({ ...s, uncategorizedCount: Math.max(0, s.uncategorizedCount - count) }));
      setUncatSelected(new Set());
      setBulkCategoryId("");
      toast.success(`${count} movimiento${count !== 1 ? "s" : ""} categorizados`);
    } catch {
      toast.error("No se pudo aplicar. Intentá de nuevo.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleApplyFrequent(key: string, transactionIds: string[], categoryId: string) {
    if (!categoryId) { toast.error("Elegí una categoría primero."); return; }
    setFreqApplying(key);
    try {
      const r = await fetch("/api/transactions/bulk-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, transactionIds, categoryId }),
      });
      if (!r.ok) throw new Error();
      const json = await r.json() as { data?: { updated?: number } };
      const count = (json.data?.updated ?? 0);
      setFreqRows((rows) => rows.filter((row) => row.key !== key));
      setSignals((s) => ({ ...s, uncategorizedCount: Math.max(0, s.uncategorizedCount - count), frequentGroupCount: Math.max(0, s.frequentGroupCount - 1) }));
      toast.success(`${count} movimiento${count !== 1 ? "s" : ""} categorizados`);
    } catch {
      toast.error("No se pudo aplicar. Intentá de nuevo.");
    } finally {
      setFreqApplying(null);
    }
  }

  async function handleMerge(pairIndex: number, keepId: string, removeId: string) {
    const pair = simRows[pairIndex];
    if (!pair) return;
    const key = `${pair.a.id}-${pair.b.id}`;
    setSimMerging(key);
    try {
      const r = await fetch("/api/categories/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, fromId: removeId, toId: keepId }),
      });
      if (!r.ok) throw new Error();
      setSimRows((rows) => rows.filter((_, i) => i !== pairIndex));
      setSignals((s) => ({ ...s, similarCategoryPairs: Math.max(0, s.similarCategoryPairs - 1) }));
      toast.success("Categorías unificadas");
    } catch {
      toast.error("No se pudo unificar. Intentá de nuevo.");
    } finally {
      setSimMerging(null);
    }
  }

  async function handleArchiveUnused(categoryId: string) {
    setArchivingId(categoryId);
    try {
      const r = await fetch(`/api/categories/${categoryId}?householdId=${householdId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setUnusedRows((rows) => rows.filter((row) => row.id !== categoryId));
      setSignals((s) => ({ ...s, unusedCategoryCount: Math.max(0, s.unusedCategoryCount - 1) }));
      toast.success("Categoría archivada");
    } catch {
      toast.error("No se pudo archivar. Intentá de nuevo.");
    } finally {
      setArchivingId(null);
    }
  }

  // ── Tab config ────────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; label: string; count: number; accent: "amber" | "teal" | "blue" | "muted" }> = [
    { id: "uncategorized", label: "Sin categoría", count: signals.uncategorizedCount, accent: "amber" },
    { id: "frequent", label: "Frecuentes", count: signals.frequentGroupCount, accent: "teal" },
    { id: "similar", label: "Similares", count: signals.similarCategoryPairs, accent: "blue" },
    { id: "unused", label: "Sin uso", count: signals.unusedCategoryCount, accent: "muted" },
    { id: "merchants", label: "Comercios", count: signals.similarMerchantGroupCount, accent: "teal" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Signal cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tabs.map((t) => (
          <SignalCard
            key={t.id}
            count={t.count}
            label={t.label}
            accent={t.accent}
            onClick={() => handleTabChange(t.id)}
            active={activeTab === t.id}
          />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-muted/20 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabChange(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150",
              activeTab === t.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                activeTab === t.id ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Sin categoría ── */}
      {activeTab === "uncategorized" && (
        <div className="space-y-3">
          {uncatRows.length === 0 ? (
            <PremiumCard><PremiumCardContent><EmptyCheck message="Todo categorizado. Si aparece algo nuevo, lo vamos a separar acá para corregirlo rápido." /></PremiumCardContent></PremiumCard>
          ) : (
            <>
              {/* Bulk action bar */}
              {uncatSelected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">
                    {uncatSelected.size} seleccionado{uncatSelected.size !== 1 ? "s" : ""}
                  </span>
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 [&>option]:bg-card"
                  >
                    <option value="">Elegir categoría</option>
                    {["EXPENSE", "INCOME"].map((type) => {
                      const filtered = categories.filter((c) => c.type === type);
                      if (filtered.length === 0) return null;
                      return (
                        <optgroup key={type} label={CAT_TYPE_LABELS[type] ?? type}>
                          {filtered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ActionButton size="sm" disabled={!bulkCategoryId || bulkSaving} onClick={() => void handleBulkCategorize()}>
                    {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                    Aplicar
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => { setUncatSelected(new Set()); setBulkCategoryId(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-label="Cancelar selección" />
                  </button>
                </div>
              )}

              <PremiumCard>
                <div className="divide-y divide-border/50">
                  {/* Select-all header */}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-primary"
                      checked={uncatSelected.size === uncatRows.length && uncatRows.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setUncatSelected(new Set(uncatRows.map((row) => row.id)));
                        else setUncatSelected(new Set());
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {uncatRows.length} movimiento{uncatRows.length !== 1 ? "s" : ""} sin categoría
                    </span>
                  </div>

                  {uncatRows.map((row) => {
                    const rowCats = categoriesForType(categories, row.type);
                    const isSaving = uncatSaving === row.id;
                    const isSelected = uncatSelected.has(row.id);

                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors sm:flex-nowrap",
                          isSelected && "bg-muted/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded accent-primary"
                          checked={isSelected}
                          onChange={(e) => {
                            setUncatSelected((s) => {
                              const ns = new Set(s);
                              if (e.target.checked) ns.add(row.id); else ns.delete(row.id);
                              return ns;
                            });
                          }}
                        />

                        <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatDate(row.occurredAt)}
                        </span>

                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {row.description ?? <span className="italic text-muted-foreground">Sin descripción</span>}
                        </span>

                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {formatAmount(row.amount, row.currency)}
                        </span>

                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {row.accountName}
                        </span>

                        {/* Category select with hint */}
                        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                          {row.suggestedCategoryId && !isSaving && (
                            <button
                              type="button"
                              title={`Aplicar: ${row.suggestedCategoryName}`}
                              onClick={() => void handleSingleCategorize(row.id, row.suggestedCategoryId!)}
                              className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition hover:bg-primary/20"
                            >
                              <Lightbulb className="h-2.5 w-2.5" aria-hidden="true" />
                              {row.suggestedCategoryName}
                            </button>
                          )}
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) void handleSingleCategorize(row.id, e.target.value); }}
                              className="rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 [&>option]:bg-card"
                            >
                              <option value="">Asignar categoría</option>
                              {rowCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PremiumCard>

              {signals.uncategorizedCount > uncatRows.length && (
                <p className="text-center text-xs text-muted-foreground">
                  Mostrando {uncatRows.length} de {signals.uncategorizedCount}. Categorizá algunos para ver más.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Frecuentes ── */}
      {activeTab === "frequent" && (
        <div className="space-y-3">
          {freqRows.length === 0 ? (
            <PremiumCard><PremiumCardContent><EmptyCheck message="No hay patrones repetidos pendientes. Las reglas sugeridas van a aparecer cuando haya suficientes movimientos similares." /></PremiumCardContent></PremiumCard>
          ) : (
            freqRows.map((group) => {
              const isApplying = freqApplying === group.key;
              const currentCatId = freqCategoryId[group.key] ?? group.suggestedCategoryId ?? "";
              const expenseCats = categories.filter((c) => ["EXPENSE", "INCOME"].includes(c.type));

              return (
                <PremiumCard key={group.key}>
                  <PremiumCardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground capitalize">{group.key}</p>
                          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {group.count} movimientos
                          </span>
                          {group.suggestedHint && (
                            <span className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <Lightbulb className="h-2.5 w-2.5" aria-hidden="true" />
                              {group.suggestedHint}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatAmount(group.totalAmount, group.currency)} en total
                          {group.examples.length > 1 && ` · También: ${group.examples.slice(1).join(", ")}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={currentCatId}
                          onChange={(e) => setFreqCategoryId((m) => ({ ...m, [group.key]: e.target.value }))}
                          className="rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40 [&>option]:bg-card"
                        >
                          <option value="">Categoría</option>
                          {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ActionButton
                          size="sm"
                          disabled={!currentCatId || isApplying}
                          onClick={() => void handleApplyFrequent(group.key, group.transactionIds, currentCatId)}
                        >
                          {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          Aplicar
                        </ActionButton>
                      </div>
                    </div>
                  </PremiumCardContent>
                </PremiumCard>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab: Similares ── */}
      {activeTab === "similar" && (
        <div className="space-y-3">
          {simRows.length === 0 ? (
            <PremiumCard><PremiumCardContent><EmptyCheck message="Categorías claras. Si detectamos nombres duplicados o demasiado parecidos, te los mostramos acá." /></PremiumCardContent></PremiumCard>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Estas categorías tienen nombres muy parecidos. Unificarlas mantiene tus reportes limpios.
              </p>
              {simRows.map((pair, i) => {
                const key = `${pair.a.id}-${pair.b.id}`;
                const isMerging = simMerging === key;
                // Keep the one with more transactions
                const keepA = pair.a.transactionCount >= pair.b.transactionCount;
                const keep = keepA ? pair.a : pair.b;
                const remove = keepA ? pair.b : pair.a;

                return (
                  <PremiumCard key={key}>
                    <PremiumCardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{pair.a.name}</p>
                            <p className="text-xs text-muted-foreground">{pair.a.transactionCount} movimientos</p>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                            <Merge className="h-3 w-3" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{pair.b.name}</p>
                            <p className="text-xs text-muted-foreground">{pair.b.transactionCount} movimientos</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {pair.similarity}% similar
                          </span>
                          <ActionButton
                            size="sm"
                            variant="glass"
                            disabled={isMerging}
                            onClick={() => void handleMerge(i, keep.id, remove.id)}
                            title={`Mantener "${keep.name}", archivar "${remove.name}"`}
                          >
                            {isMerging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                            Unificar
                          </ActionButton>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Se mantendrá <strong className="text-foreground">{keep.name}</strong> y se archivará <strong className="text-foreground">{remove.name}</strong>.
                        Todos los movimientos pasarán a {keep.name}.
                      </p>
                    </PremiumCardContent>
                  </PremiumCard>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Comercios ── */}
      {activeTab === "merchants" && (
        <div className="space-y-3">
          {merchantRows.length === 0 ? (
            <PremiumCard><PremiumCardContent><EmptyCheck message="No se detectaron comercios con variaciones en sus nombres en los últimos 90 días." /></PremiumCardContent></PremiumCard>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Estos comercios aparecen con distintas descripciones en tus movimientos. El análisis de IA los agrupa automáticamente.
              </p>
              <PremiumCard>
                <div className="divide-y divide-border/50">
                  {merchantRows.map((group) => (
                    <div key={group.canonical} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                          <Store className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{group.displayName}</p>
                            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {group.transactionCount} mov.
                            </span>
                            {group.categoryNames.length > 0 && (
                              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {group.categoryNames[0]}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Variaciones: {group.variants.map((v) => `"${v}"`).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Sin uso ── */}
      {activeTab === "unused" && (
        <div className="space-y-3">
          {unusedRows.length === 0 ? (
            <PremiumCard><PremiumCardContent><EmptyCheck message="Todas las categorías tienen al menos un movimiento asignado." /></PremiumCardContent></PremiumCard>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Estas categorías no tienen movimientos asignados. Podés archivarlas para mantener la lista limpia.
              </p>
              <PremiumCard>
                <div className="divide-y divide-border/50">
                  {unusedRows.map((cat) => {
                    const isArchiving = archivingId === cat.id;
                    return (
                      <div key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                            <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">{CAT_TYPE_LABELS[cat.type] ?? cat.type}</p>
                          </div>
                        </div>
                        <ActionButton
                          size="sm"
                          variant="quiet"
                          disabled={isArchiving}
                          onClick={() => void handleArchiveUnused(cat.id)}
                        >
                          {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                          Archivar
                        </ActionButton>
                      </div>
                    );
                  })}
                </div>
              </PremiumCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
