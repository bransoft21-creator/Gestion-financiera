"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Copy,
  FileImage,
  FileScan,
  Loader2,
  Minus,
  Plus,
  Scan,
  Shield,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { V2PageShell } from "@/components/layout/v2-page-shell";
import { v2MotionTokens } from "@/design-system/tokens";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";
type Currency = "ARS" | "USD";
type PayMethod = "CASH" | "DEBIT" | "CREDIT" | "TRANSFER" | null;
type ExpType = "FIXED" | "VARIABLE" | "EXTRAORDINARY" | null;
type Origin = "MANUAL" | "CARD_SUMMARY" | "BANK" | "MERCADO_PAGO";

type ImportCandidate = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  occurredAt: string | null;
  type: TxType;
  paymentMethod: PayMethod;
  expenseType: ExpType;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  origin: Origin;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  confidence: number;
  isCharge: boolean;
  isTax: boolean;
  warning: string | null;
  possibleDuplicate: boolean;
  duplicateInfo: { date: string; amount: number; description: string } | null;
};

type ImportMetadata = {
  sourceType: string;
  currency: Currency;
  warnings: string[];
  totalDetected: number;
};

type WorkspaceAccount = { id: string; name: string; type: string; currency: Currency };
type WorkspaceCategory = { id: string; name: string; type: string };

type CandidateState = ImportCandidate & {
  selected: boolean;
  expanded: boolean;
  editDescription: string;
  editAmount: string;
  editDate: string;
  editAccountId: string;
  editCategoryId: string;
  editType: TxType;
};

type Step = "upload" | "processing" | "review" | "confirming" | "done";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  householdId: string;
  accounts: WorkspaceAccount[];
  categories: WorkspaceCategory[];
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SmartImportClient({ householdId, accounts, categories }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const processFile = useCallback(
    async (file: File) => {
      const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!ALLOWED.includes(file.type)) {
        toast.error("Formato no soportado. Usá JPG, PNG, WEBP o PDF.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("El archivo es demasiado grande. Máximo 10 MB.");
        return;
      }

      setStep("processing");

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("householdId", householdId);

        const res = await fetch("/api/ai/smart-import", { method: "POST", body: form });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Error al procesar el documento.");
        }

        const { data } = (await res.json()) as {
          data: { candidates: ImportCandidate[]; metadata: ImportMetadata };
        };

        const stateList: CandidateState[] = data.candidates.map((c) => ({
          ...c,
          selected: !c.possibleDuplicate,
          expanded: false,
          editDescription: c.description,
          editAmount: c.amount.toFixed(2),
          editDate: c.occurredAt ?? today,
          editAccountId: c.suggestedAccountId ?? accounts[0]?.id ?? "",
          editCategoryId: c.suggestedCategoryId ?? "",
          editType: c.type,
        }));

        setCandidates(stateList);
        setMetadata(data.metadata);
        setStep("review");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error desconocido.");
        setStep("upload");
      }
    },
    [householdId, accounts, today],
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) processFile(f);
      e.target.value = "";
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile],
  );

  const patch = useCallback(
    (id: string, changes: Partial<CandidateState>) =>
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c))),
    [],
  );

  const toggleSelect = useCallback(
    (id: string) => setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))),
    [],
  );

  const selectAll = useCallback(
    (val: boolean) => setCandidates((prev) => prev.map((c) => ({ ...c, selected: val }))),
    [],
  );

  const selected = candidates.filter((c) => c.selected);

  const handleConfirm = useCallback(async () => {
    if (selected.length === 0) {
      toast.error("Seleccioná al menos una transacción.");
      return;
    }
    setStep("confirming");

    try {
      const payload = {
        householdId,
        candidates: selected.map((c) => ({
          accountId: c.editAccountId,
          categoryId: c.editCategoryId || undefined,
          type: c.editType,
          currency: c.currency,
          amount: parseFloat(c.editAmount) || c.amount,
          description: c.editDescription.trim() || undefined,
          origin: c.origin,
          paymentMethod: c.paymentMethod ?? undefined,
          expenseType: c.expenseType ?? undefined,
          isInstallment: c.isInstallment,
          installmentNumber: c.installmentNumber ?? undefined,
          totalInstallments: c.totalInstallments ?? undefined,
          occurredAt: c.editDate,
          status: "CONFIRMED",
        })),
      };

      const res = await fetch("/api/transactions/import-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Error al guardar.");
      }

      const { data } = (await res.json()) as {
        data: { created: unknown[]; errors: unknown[] };
      };
      const created = data.created?.length ?? selected.length;
      const errors = (data.errors as { index: number; message: string }[]) ?? [];

      if (errors.length > 0 && created === 0) {
        throw new Error("No se pudo guardar ninguna transacción. Revisá los datos.");
      }

      if (errors.length > 0) {
        toast.warning(`${created} transacciones guardadas. ${errors.length} tuvieron errores.`);
      }

      setImportedCount(created);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
      setStep("review");
    }
  }, [householdId, selected]);

  const reset = useCallback(() => {
    setCandidates([]);
    setMetadata(null);
    setImportedCount(0);
    setStep("upload");
  }, []);

  return (
    <V2PageShell
      eyebrow="IA"
      title="Smart Import"
      description="Subí un comprobante, ticket o screenshot y la IA detecta las transacciones automáticamente."
    >
      <AnimatePresence mode="wait">
        {step === "upload" && (
          <FadeStep key="upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={handleFile}
              capture="environment"
            />
            <UploadZone
              isDragging={isDragging}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClickUpload={() => fileInputRef.current?.click()}
            />
          </FadeStep>
        )}

        {step === "processing" && (
          <FadeStep key="processing">
            <ProcessingView />
          </FadeStep>
        )}

        {step === "review" && metadata && (
          <FadeStep key="review">
            <ReviewView
              candidates={candidates}
              metadata={metadata}
              accounts={accounts}
              categories={categories}
              selectedCount={selected.length}
              onPatch={patch}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onConfirm={handleConfirm}
              onReset={reset}
            />
          </FadeStep>
        )}

        {step === "confirming" && (
          <FadeStep key="confirming">
            <ConfirmingView count={selected.length} />
          </FadeStep>
        )}

        {step === "done" && (
          <FadeStep key="done">
            <DoneView count={importedCount} onReset={reset} />
          </FadeStep>
        )}
      </AnimatePresence>
    </V2PageShell>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------

function UploadZone({
  isDragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onClickUpload,
}: {
  isDragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClickUpload: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div
        animate={{ borderColor: isDragging ? "rgba(45,212,191,0.5)" : "rgba(255,255,255,0.08)" }}
        transition={{ duration: 0.2 }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed p-10 text-center transition-colors duration-200",
          isDragging ? "bg-teal-500/5" : "bg-white/[0.02] hover:bg-white/[0.04]",
        )}
        onClick={onClickUpload}
      >
        <motion.div
          animate={isDragging ? { scale: 1.12, rotate: -6 } : { scale: 1, rotate: 0 }}
          transition={v2MotionTokens.spring}
          className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] shadow-[0_20px_60px_rgba(45,212,191,0.12)]"
        >
          {isDragging ? (
            <Scan className="h-9 w-9 text-teal-300" />
          ) : (
            <FileScan className="h-9 w-9 text-zinc-400" />
          )}
        </motion.div>

        <div className="space-y-2">
          <p className="text-lg font-semibold text-white">
            {isDragging ? "Soltá el archivo aquí" : "Subí tu comprobante"}
          </p>
          <p className="text-sm text-zinc-500">
            Arrastrá y soltá o hacé clic para seleccionar
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {["JPG", "PNG", "WEBP", "PDF"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-zinc-400"
            >
              {fmt}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: FileImage, title: "Screenshots", desc: "Capturas de Mercado Pago, Visa, Mastercard" },
          { icon: FileScan, title: "Resúmenes", desc: "PDFs de resúmenes bancarios y de tarjeta" },
          { icon: Scan, title: "Tickets", desc: "Fotos de tickets y comprobantes físicos" },
        ].map(({ icon: Icon, title, desc }) => (
          <PremiumCard key={title} variant="quiet" className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl border border-white/10 bg-white/[0.05] p-2">
                <Icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-zinc-500">{desc}</p>
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>

      <p className="text-center text-xs text-zinc-600">
        La IA nunca guarda automáticamente — siempre revisás y confirmás antes de importar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Processing view
// ---------------------------------------------------------------------------

function ProcessingView() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-8">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-teal-400/20 blur-2xl"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-[0_0_60px_rgba(45,212,191,0.15)]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-10 w-10 text-teal-300" />
          </motion.div>
        </div>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-xl font-semibold text-white">Analizando documento</p>
        <motion.p
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="text-sm text-zinc-500"
        >
          La IA está detectando transacciones…
        </motion.p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review view
// ---------------------------------------------------------------------------

function ReviewView({
  candidates,
  metadata,
  accounts,
  categories,
  selectedCount,
  onPatch,
  onToggleSelect,
  onSelectAll,
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
  onConfirm: () => void;
  onReset: () => void;
}) {
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300">
              {sourceTypeLabel(metadata.sourceType)}
            </span>
            <span className="text-sm text-zinc-500">
              {candidates.length} detectada{candidates.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(!allSelected)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            {allSelected ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
          <ActionButton
            variant="glass"
            size="sm"
            onClick={onReset}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </ActionButton>
        </div>
      </div>

      {/* Global warnings */}
      {metadata.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-1">
              {metadata.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-200">{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Candidate list */}
      <div className="space-y-3">
        {candidates.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.28, ease: v2MotionTokens.easeOut }}
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

      {/* Sticky confirm bar */}
      <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-10 sm:static sm:bottom-auto sm:z-auto">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl sm:bg-transparent sm:shadow-none sm:backdrop-blur-none sm:border-0 sm:p-0">
          <ActionButton
            className="w-full"
            disabled={selectedCount === 0}
            onClick={onConfirm}
          >
            <CircleDollarSign className="h-4 w-4" />
            Importar {selectedCount} transacción{selectedCount !== 1 ? "es" : ""}
            <ArrowRight className="h-4 w-4" />
          </ActionButton>
          {selectedCount === 0 && (
            <p className="mt-2 text-center text-xs text-zinc-600">
              Seleccioná al menos una transacción para importar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate card
// ---------------------------------------------------------------------------

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
      className={cn(
        "transition-opacity duration-150",
        !c.selected && "opacity-50",
      )}
    >
      <PremiumCardContent className="p-4 sm:p-5">
        {/* Row 1: checkbox + type + description + amount */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={c.selected ? "Deseleccionar" : "Seleccionar"}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
              c.selected
                ? "border-teal-400/60 bg-teal-400/20 text-teal-300"
                : "border-white/20 bg-white/[0.04]",
            )}
          >
            {c.selected && <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>

          <div className="min-w-0 flex-1 space-y-3">
            {/* Description + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", typeBadgeClass(c.editType))}>
                {typeLabel(c.editType)}
              </span>
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

            {/* Description input */}
            <input
              type="text"
              value={c.editDescription}
              onChange={(e) => onPatch({ editDescription: e.target.value })}
              maxLength={80}
              placeholder="Descripción"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none ring-0 focus:border-teal-400/40 focus:bg-white/[0.07]"
            />

            {/* Amount + date row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
                  {c.currency === "USD" ? "USD" : "$"}
                </span>
                <input
                  type="number"
                  value={c.editAmount}
                  onChange={(e) => onPatch({ editAmount: e.target.value })}
                  step="0.01"
                  min="0.01"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-10 pr-3 text-sm font-semibold tabular-nums text-white outline-none focus:border-teal-400/40 focus:bg-white/[0.07]"
                />
              </div>
              <input
                type="date"
                value={c.editDate}
                onChange={(e) => onPatch({ editDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40 focus:bg-white/[0.07] [color-scheme:dark]"
              />
            </div>

            {/* Account + Category row */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  Cuenta
                </label>
                <select
                  value={c.editAccountId}
                  onChange={(e) => onPatch({ editAccountId: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40 [&>option]:bg-zinc-900"
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
                <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  Categoría
                </label>
                <select
                  value={c.editCategoryId}
                  onChange={(e) => onPatch({ editCategoryId: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40 [&>option]:bg-zinc-900"
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

            {/* Confidence + warnings */}
            <div className="flex flex-wrap items-center gap-3">
              <ConfidencePip value={c.confidence} />
              {c.warning && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  {c.warning}
                </span>
              )}
              {c.possibleDuplicate && c.duplicateInfo && (
                <span className="text-xs text-zinc-500">
                  Ya existe: {c.duplicateInfo.date} · ${c.duplicateInfo.amount.toLocaleString("es-AR")}
                </span>
              )}
            </div>
          </div>
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}

// ---------------------------------------------------------------------------
// Confirming view
// ---------------------------------------------------------------------------

function ConfirmingView({ count }: { count: number }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-teal-400/15 blur-2xl"
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
        </div>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold text-white">Guardando transacciones</p>
        <p className="text-sm text-zinc-500">
          Procesando {count} movimiento{count !== 1 ? "s" : ""}…
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Done view
// ---------------------------------------------------------------------------

function DoneView({ count, onReset }: { count: number; onReset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-8">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={v2MotionTokens.spring}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-teal-400/30 bg-teal-400/10 shadow-[0_0_60px_rgba(45,212,191,0.2)]">
          <CheckCircle2 className="h-12 w-12 text-teal-300" />
        </div>
      </motion.div>

      <div className="space-y-2 text-center">
        <p className="text-2xl font-semibold text-white">
          {count} transacción{count !== 1 ? "es" : ""} importada{count !== 1 ? "s" : ""}
        </p>
        <p className="text-sm text-zinc-500">
          Ya están en tus movimientos con todos los detalles detectados.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <ActionButton asChild variant="primary">
          <Link href="/transactions">
            Ver movimientos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ActionButton>
        <ActionButton variant="glass" onClick={onReset}>
          Importar otro
        </ActionButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function FadeStep({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={v2MotionTokens.fadeUp.hidden}
      animate={v2MotionTokens.fadeUp.visible}
      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
      transition={{ duration: v2MotionTokens.base, ease: v2MotionTokens.easeOut }}
    >
      {children}
    </motion.div>
  );
}

function ConfidencePip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 85 ? "text-teal-400" : pct >= 60 ? "text-amber-400" : "text-rose-400";
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium tabular-nums", color)}>
      <Shield className="h-3 w-3" />
      {pct}% confianza
    </span>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function typeLabel(type: TxType): string {
  switch (type) {
    case "INCOME": return "Ingreso";
    case "TRANSFER": return "Transferencia";
    default: return "Gasto";
  }
}

function typeBadgeClass(type: TxType): string {
  switch (type) {
    case "INCOME": return "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "TRANSFER": return "border border-blue-400/20 bg-blue-400/10 text-blue-300";
    default: return "border border-rose-400/20 bg-rose-400/10 text-rose-300";
  }
}

function sourceTypeLabel(t: string): string {
  switch (t) {
    case "CARD_SUMMARY": return "Resumen de tarjeta";
    case "BANK": return "Extracto bancario";
    case "MERCADO_PAGO": return "Mercado Pago";
    case "TICKET": return "Ticket";
    case "RECEIPT": return "Comprobante";
    default: return "Documento detectado";
  }
}
