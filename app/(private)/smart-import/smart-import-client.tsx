"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  FileImage,
  FileScan,
  Loader2,
  Minus,
  Plus,
  Scan,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
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
type CandidateFilter = "all" | "safe" | "review" | "duplicates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROCESSING_STEPS = [
  "Leyendo el documento…",
  "Detectando comercios…",
  "Identificando importes…",
  "Clasificando movimientos…",
  "Verificando duplicados…",
  "Preparando resultados…",
];

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
  const [discardedCount, setDiscardedCount] = useState(0);
  const [duplicatesAvoided, setDuplicatesAvoided] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const handleFileSelect = useCallback((file: File) => {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato no soportado. Usá JPG, PNG, WEBP o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Máximo 10 MB.");
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  }, []);

  const handleClearFile = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const processSelectedFile = useCallback(async () => {
    if (!selectedFile) return;
    setStep("processing");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
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
  }, [selectedFile, householdId, accounts, today]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  const patch = useCallback(
    (id: string, changes: Partial<CandidateState>) =>
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c))),
    [],
  );

  const toggleSelect = useCallback(
    (id: string) =>
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
      ),
    [],
  );

  const selectAll = useCallback(
    (val: boolean) => setCandidates((prev) => prev.map((c) => ({ ...c, selected: val }))),
    [],
  );

  const selectSafe = useCallback(
    () =>
      setCandidates((prev) =>
        prev.map((c) => ({
          ...c,
          selected: c.confidence >= 0.85 && !c.possibleDuplicate && !c.warning,
        })),
      ),
    [],
  );

  const deselectDuplicates = useCallback(
    () =>
      setCandidates((prev) =>
        prev.map((c) => (c.possibleDuplicate ? { ...c, selected: false } : c)),
      ),
    [],
  );

  const selected = useMemo(() => candidates.filter((c) => c.selected), [candidates]);

  const handleConfirm = useCallback(async () => {
    const toImport = candidates.filter((c) => c.selected);
    if (toImport.length === 0) {
      toast.error("Seleccioná al menos una transacción.");
      return;
    }

    const notSelected = candidates.filter((c) => !c.selected);
    const dupsAvoided = candidates.filter((c) => c.possibleDuplicate && !c.selected);

    setStep("confirming");

    try {
      const payload = {
        householdId,
        candidates: toImport.map((c) => ({
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
      const created = data.created?.length ?? toImport.length;
      const errors = (data.errors as { index: number; message: string }[]) ?? [];

      if (errors.length > 0 && created === 0) {
        throw new Error("No se pudo guardar ninguna transacción. Revisá los datos.");
      }

      if (errors.length > 0) {
        toast.warning(`${created} transacciones guardadas. ${errors.length} tuvieron errores.`);
      }

      setImportedCount(created);
      setDiscardedCount(notSelected.length);
      setDuplicatesAvoided(dupsAvoided.length);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
      setStep("review");
    }
  }, [householdId, candidates]);

  const reset = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setCandidates([]);
    setMetadata(null);
    setImportedCount(0);
    setDiscardedCount(0);
    setDuplicatesAvoided(0);
    setStep("upload");
  }, []);

  return (
    <V2PageShell
      eyebrow="IA"
      title="Smart Import"
      description="Subí un comprobante, ticket o screenshot y la IA detecta las transacciones automáticamente."
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={handleInputChange}
      />

      <AnimatePresence mode="wait">
        {step === "upload" && (
          <FadeStep key="upload">
            <UploadZone
              selectedFile={selectedFile}
              filePreviewUrl={filePreviewUrl}
              isDragging={isDragging}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onClickUpload={() => fileInputRef.current?.click()}
              onAnalyze={processSelectedFile}
              onClearFile={handleClearFile}
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
              onSelectSafe={selectSafe}
              onDeselectDuplicates={deselectDuplicates}
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
            <DoneView
              imported={importedCount}
              discarded={discardedCount}
              duplicatesAvoided={duplicatesAvoided}
              onReset={reset}
            />
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
  selectedFile,
  filePreviewUrl,
  isDragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onClickUpload,
  onAnalyze,
  onClearFile,
}: {
  selectedFile: File | null;
  filePreviewUrl: string | null;
  isDragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClickUpload: () => void;
  onAnalyze: () => void;
  onClearFile: () => void;
}) {
  if (selectedFile) {
    return (
      <FilePreviewState
        file={selectedFile}
        previewUrl={filePreviewUrl}
        onAnalyze={onAnalyze}
        onClear={onClearFile}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div
        animate={{
          borderColor: isDragging ? "rgba(45,212,191,0.5)" : "rgba(255,255,255,0.08)",
          backgroundColor: isDragging ? "rgba(45,212,191,0.04)" : "rgba(255,255,255,0.01)",
        }}
        transition={{ duration: 0.2 }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed p-10 text-center transition-colors duration-200 hover:bg-white/[0.02]"
        onClick={onClickUpload}
      >
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(45,212,191,0.08) 0%, transparent 70%)",
            }}
          />
        )}

        <motion.div
          animate={isDragging ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
          transition={v2MotionTokens.spring}
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-3xl border transition-colors duration-200",
            isDragging
              ? "border-teal-400/30 bg-teal-400/10 shadow-[0_0_40px_rgba(45,212,191,0.2)]"
              : "border-white/10 bg-white/[0.06]",
          )}
        >
          {isDragging ? (
            <Scan className="h-9 w-9 text-teal-300" />
          ) : (
            <FileScan className="h-9 w-9 text-zinc-400" />
          )}
        </motion.div>

        <div className="space-y-2">
          <p className="text-lg font-semibold text-white">
            {isDragging ? "Soltá el archivo para analizarlo" : "Subí tu comprobante"}
          </p>
          <p className="text-sm text-zinc-500">
            {isDragging
              ? "La IA lo va a leer y detectar los movimientos"
              : "Arrastrá y soltá, o tocá para seleccionar"}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {["JPG", "PNG", "WEBP", "PDF"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-zinc-500"
            >
              {fmt}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: FileImage,
            title: "Screenshots",
            desc: "Capturas de Mercado Pago, Visa o Mastercard",
          },
          {
            icon: FileScan,
            title: "Resúmenes",
            desc: "PDFs de resúmenes bancarios y de tarjeta",
          },
          {
            icon: Scan,
            title: "Tickets",
            desc: "Fotos de tickets y comprobantes físicos",
          },
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
        La IA nunca guarda automáticamente. Siempre revisás y confirmás antes de importar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File preview state
// ---------------------------------------------------------------------------

function FilePreviewState({
  file,
  previewUrl,
  onAnalyze,
  onClear,
}: {
  file: File;
  previewUrl: string | null;
  onAnalyze: () => void;
  onClear: () => void;
}) {
  const isPDF = file.type === "application/pdf";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={v2MotionTokens.spring}
        className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]"
      >
        <div className="flex min-h-[200px] items-center justify-center bg-zinc-950/40">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-[380px] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-14">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                <FileScan className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-500">Documento PDF listo para analizar</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{file.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {formatFileSize(file.size)} · {isPDF ? "PDF" : file.type.split("/")[1]?.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Cambiar archivo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-400 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      <ActionButton className="w-full" onClick={onAnalyze}>
        <Sparkles className="h-4 w-4" />
        Analizar documento
        <ArrowRight className="h-4 w-4" />
      </ActionButton>

      <p className="text-center text-xs text-zinc-600">
        La IA nunca guarda automáticamente. Siempre revisás y confirmás antes de importar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Processing view — cinematic sequential steps
// ---------------------------------------------------------------------------

function ProcessingView() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= PROCESSING_STEPS.length - 1) return;
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 1400);
    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-14">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.25, 0.08, 0.25] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-teal-400/25 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-28 w-28 items-center justify-center rounded-full border border-teal-400/20 bg-teal-400/[0.07] shadow-[0_0_80px_rgba(45,212,191,0.18)]"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-12 w-12 text-teal-300" />
          </motion.div>
        </motion.div>
      </div>

      <div className="w-full max-w-xs space-y-4">
        {PROCESSING_STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const pending = i > currentStep;
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: pending ? 0.22 : 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.3, ease: v2MotionTokens.easeOut }}
              className="flex items-center gap-3"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {done && <CheckCircle2 className="h-4 w-4 text-teal-400" />}
                {active && (
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="h-2.5 w-2.5 rounded-full bg-teal-400"
                  />
                )}
                {pending && <div className="h-2 w-2 rounded-full bg-white/15" />}
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  done && "text-teal-400",
                  active && "text-white",
                  pending && "text-zinc-600",
                )}
              >
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-600">Esto puede tomar unos segundos…</p>
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

  const selectedTotal = useMemo(
    () =>
      candidates
        .filter((c) => c.selected)
        .reduce((sum, c) => sum + (parseFloat(c.editAmount) || 0), 0),
    [candidates],
  );

  const allSelected = candidates.length > 0 && selectedCount === candidates.length;

  return (
    <div className="space-y-4 pb-[220px] sm:pb-6">
      {/* Global warnings */}
      {metadata.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-1">
              {metadata.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-200">
                  {w}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Narrative summary */}
      <NarrativeSummary candidates={candidates} metadata={metadata} selectedCount={selectedCount} />

      {/* Quick actions bar */}
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

      {/* Candidate list */}
      {displayedCandidates.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-zinc-500">
            No hay transacciones en esta vista.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedCandidates.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.06,
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

      {/* Desktop confirm bar */}
      <div className="hidden sm:block">
        <ConfirmBar
          selectedCount={selectedCount}
          selectedTotal={selectedTotal}
          onConfirm={onConfirm}
          onReset={onReset}
        />
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 px-4 sm:hidden">
        <div
          className="rounded-2xl border border-white/10 p-3 shadow-2xl"
          style={{
            background: "rgba(5,8,15,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <ConfirmBar
            selectedCount={selectedCount}
            selectedTotal={selectedTotal}
            onConfirm={onConfirm}
            onReset={onReset}
            compact
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Narrative summary card
// ---------------------------------------------------------------------------

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
    () => candidates.reduce((sum, c) => sum + (parseFloat(c.editAmount) || 0), 0),
    [candidates],
  );
  const highConf = candidates.filter((c) => c.confidence >= 0.85).length;
  const medConf = candidates.filter((c) => c.confidence >= 0.65 && c.confidence < 0.85).length;
  const lowConf = candidates.filter((c) => c.confidence < 0.65).length;
  const duplicates = candidates.filter((c) => c.possibleDuplicate).length;
  const currency = metadata.currency ?? "ARS";

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
            <p className="text-2xl font-bold tabular-nums text-white">
              {currency === "USD" ? "USD " : "$ "}
              {Math.round(total).toLocaleString("es-AR")}
            </p>
            <p className="text-sm text-zinc-400">
              {candidates.length} movimiento{candidates.length !== 1 ? "s" : ""} detectado
              {candidates.length !== 1 ? "s" : ""}
            </p>
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
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
            {selectedCount} de {candidates.length} seleccionadas para importar.{" "}
            {candidates.length - selectedCount} se van a descartar.
          </p>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

// ---------------------------------------------------------------------------
// Quick actions bar
// ---------------------------------------------------------------------------

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
      {/* Filter tabs */}
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
                : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-300",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectAll(!allSelected)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08]"
        >
          {allSelected ? (
            <Minus className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
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

// ---------------------------------------------------------------------------
// Confirm bar (shared desktop / mobile)
// ---------------------------------------------------------------------------

function ConfirmBar({
  selectedCount,
  selectedTotal,
  onConfirm,
  onReset,
  compact = false,
}: {
  selectedCount: number;
  selectedTotal: number;
  onConfirm: () => void;
  onReset: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {selectedCount > 0 ? (
              <>
                <span className="text-teal-300">{selectedCount}</span>{" "}
                seleccionada{selectedCount !== 1 ? "s" : ""}
              </>
            ) : (
              <span className="text-zinc-500">Ninguna seleccionada</span>
            )}
          </p>
          {selectedCount > 0 && (
            <p className="text-xs text-zinc-500">
              $ {Math.round(selectedTotal).toLocaleString("es-AR")}
            </p>
          )}
        </div>
        <ActionButton
          size="sm"
          disabled={selectedCount === 0}
          onClick={onConfirm}
        >
          <CircleDollarSign className="h-3.5 w-3.5" />
          Importar
          <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ActionButton
        className="flex-1 sm:flex-none"
        disabled={selectedCount === 0}
        onClick={onConfirm}
      >
        <CircleDollarSign className="h-4 w-4" />
        Importar {selectedCount} transacción{selectedCount !== 1 ? "es" : ""}
        {selectedCount > 0 && (
          <span className="ml-1 text-teal-200/70">
            · $ {Math.round(selectedTotal).toLocaleString("es-AR")}
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
      className={cn("transition-all duration-200", !c.selected && "opacity-50")}
    >
      <PremiumCardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
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
            {/* Badges row */}
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

            {/* Description input */}
            <input
              type="text"
              value={c.editDescription}
              onChange={(e) => onPatch({ editDescription: e.target.value })}
              maxLength={80}
              placeholder="Descripción"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-teal-400/40 focus:bg-white/[0.07]"
            />

            {/* Amount + date */}
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

            {/* Account + Category */}
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

            {/* Warning + duplicate info */}
            {(c.warning || (c.possibleDuplicate && c.duplicateInfo)) && (
              <div className="space-y-1">
                {c.warning && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {c.warning}
                  </span>
                )}
                {c.possibleDuplicate && c.duplicateInfo && (
                  <span className="text-xs text-zinc-500">
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

// ---------------------------------------------------------------------------
// Confirming view
// ---------------------------------------------------------------------------

function ConfirmingView({ count }: { count: number }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.25, 1] }}
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
// Done view — full stats
// ---------------------------------------------------------------------------

function DoneView({
  imported,
  discarded,
  duplicatesAvoided,
  onReset,
}: {
  imported: number;
  discarded: number;
  duplicatesAvoided: number;
  onReset: () => void;
}) {
  const timeSaved = imported * 2;

  const stats = [
    {
      label: "Importadas",
      value: imported,
      icon: CheckCircle2,
      textClass: "text-teal-400",
      borderClass: "border-teal-400/20",
      bgClass: "bg-teal-400/[0.07]",
    },
    {
      label: "Descartadas",
      value: discarded,
      icon: X,
      textClass: "text-zinc-400",
      borderClass: "border-white/10",
      bgClass: "bg-white/[0.03]",
    },
    {
      label: "Duplicados evitados",
      value: duplicatesAvoided,
      icon: ShieldCheck,
      textClass: "text-amber-400",
      borderClass: "border-amber-400/20",
      bgClass: "bg-amber-400/[0.07]",
    },
    {
      label: "Minutos ahorrados",
      value: `~${timeSaved}`,
      icon: Clock,
      textClass: "text-blue-400",
      borderClass: "border-blue-400/20",
      bgClass: "bg-blue-400/[0.07]",
    },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-10 py-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={v2MotionTokens.spring}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-teal-400/30 bg-teal-400/10 shadow-[0_0_60px_rgba(45,212,191,0.25)]">
          <CheckCircle2 className="h-12 w-12 text-teal-300" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4 }}
        className="space-y-2 text-center"
      >
        <p className="text-2xl font-semibold text-white">
          {imported === 0
            ? "Sin transacciones importadas"
            : `Listo. ${imported} movimiento${imported !== 1 ? "s" : ""} guardado${imported !== 1 ? "s" : ""}.`}
        </p>
        <p className="text-sm text-zinc-500">
          Ya están disponibles en tus movimientos con todos los detalles detectados.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.4 }}
        className="grid w-full max-w-sm grid-cols-2 gap-3"
      >
        {stats.map(({ label, value, icon: Icon, textClass, borderClass, bgClass }) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2.5 rounded-2xl border p-4",
              borderClass,
              bgClass,
            )}
          >
            <Icon className={cn("h-4 w-4", textClass)} />
            <div>
              <p className={cn("text-xl font-bold tabular-nums", textClass)}>{value}</p>
              <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.48, duration: 0.4 }}
        className="flex flex-wrap justify-center gap-3"
      >
        <ActionButton asChild variant="primary">
          <Link href="/transactions">
            Ver movimientos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ActionButton>
        <ActionButton variant="glass" onClick={onReset}>
          Importar otro
        </ActionButton>
      </motion.div>
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(type: TxType): string {
  switch (type) {
    case "INCOME":
      return "Ingreso";
    case "TRANSFER":
      return "Transferencia";
    default:
      return "Gasto";
  }
}

function typeBadgeClass(type: TxType): string {
  switch (type) {
    case "INCOME":
      return "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "TRANSFER":
      return "border border-blue-400/20 bg-blue-400/10 text-blue-300";
    default:
      return "border border-rose-400/20 bg-rose-400/10 text-rose-300";
  }
}

function sourceTypeLabel(t: string): string {
  switch (t) {
    case "CARD_SUMMARY":
      return "Resumen de tarjeta";
    case "BANK":
      return "Extracto bancario";
    case "MERCADO_PAGO":
      return "Mercado Pago";
    case "TICKET":
      return "Ticket";
    case "RECEIPT":
      return "Comprobante";
    default:
      return "Documento detectado";
  }
}
