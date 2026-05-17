"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileImage,
  FileScan,
  Loader2,
  Scan,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ActionButton } from "@/components/ui-v2/action-button";
import { V2PageShell } from "@/components/layout/v2-page-shell";
import { v2MotionTokens } from "@/design-system/tokens";
import { cn } from "@/lib/utils";
import { PROCESSING_STEPS } from "./constants";
import { ReviewView } from "./review-view";
import type { WorkspaceAccount, WorkspaceCategory } from "./types";
import { useSmartImport } from "./use-smart-import";
import { formatFileSize } from "./utils";

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
  const {
    step,
    candidates,
    metadata,
    importedCount,
    discardedCount,
    duplicatesAvoided,
    isDragging,
    selectedFile,
    filePreviewUrl,
    lastError,
    isSlowProcessing,
    selected,
    fileInputRef,
    setIsDragging,
    handleClearFile,
    processSelectedFile,
    cancelProcessing,
    handleInputChange,
    handleDrop,
    patch,
    toggleSelect,
    selectAll,
    selectSafe,
    deselectDuplicates,
    handleConfirm,
    reset,
  } = useSmartImport({ householdId, accounts });
  const shouldReduceMotion = useReducedMotion();

  // Scroll to page top on every step transition — prevents black zones and
  // lost context when content height changes between steps.
  useEffect(() => {
    if (shouldReduceMotion) {
      document.documentElement.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step, shouldReduceMotion]);

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
              lastError={lastError}
            />
          </FadeStep>
        )}

        {step === "processing" && (
          <FadeStep key="processing">
            <ProcessingView isSlow={isSlowProcessing} onCancel={cancelProcessing} />
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
  lastError,
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
  lastError: string | null;
}) {
  if (selectedFile) {
    return (
      <FilePreviewState
        file={selectedFile}
        previewUrl={filePreviewUrl}
        onAnalyze={onAnalyze}
        onClear={onClearFile}
        lastError={lastError}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Dropzone — border y fondo vía clases CSS para respetar light/dark */}
      <div
        data-tutorial="smart-import-dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onClickUpload}
        role="button"
        tabIndex={0}
        aria-label="Subir comprobante — clic o arrastrá el archivo"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClickUpload(); } }}
        className={cn(
          "relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed p-8 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isDragging
            ? "border-teal-400/50 bg-teal-400/[0.04]"
            : "border-border/70 hover:border-primary/40 hover:bg-muted/20",
        )}
      >
        {isDragging && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: "radial-gradient(ellipse at center, rgba(45,212,191,0.08) 0%, transparent 70%)" }}
          />
        )}

        <motion.div
          animate={isDragging ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
          transition={v2MotionTokens.spring}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors duration-200",
            isDragging
              ? "border-teal-400/30 bg-teal-400/10 shadow-[0_0_40px_rgba(45,212,191,0.2)]"
              : "border-primary/20 bg-primary/[0.06]",
          )}
        >
          {isDragging ? (
            <Scan className="h-8 w-8 text-teal-300" />
          ) : (
            <FileScan className="h-8 w-8 text-primary/70" />
          )}
        </motion.div>

        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">
            {isDragging ? "Soltá el archivo para analizarlo" : "Subí tu comprobante"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isDragging
              ? "La IA lo va a leer y detectar los movimientos"
              : "Arrastrá y soltá o usá el botón de abajo"}
          </p>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition-colors duration-150",
            isDragging
              ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
              : "border-border bg-muted/50 text-foreground hover:bg-muted",
          )}
        >
          <FileScan className="h-3.5 w-3.5" aria-hidden="true" />
          Elegir archivo
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {["JPG", "PNG", "WEBP", "PDF"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full border border-border/50 bg-muted/30 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* Tipos aceptados — solo informativos, no interactivos */}
      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Qué podés subir
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { icon: FileImage, title: "Screenshots", desc: "Capturas de Mercado Pago, Visa o Mastercard" },
            { icon: FileScan,  title: "Resúmenes",  desc: "PDFs de resúmenes bancarios y de tarjeta" },
            { icon: Scan,      title: "Tickets",    desc: "Fotos de tickets y comprobantes físicos" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-2.5 rounded-2xl border border-border/40 bg-muted/15 p-3">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground/60">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lastError && (
        <RecoveryNotice message={lastError} onRetry={onClickUpload} actionLabel="Elegir archivo" />
      )}

      <p className="text-center text-xs text-muted-foreground">
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
  lastError,
}: {
  file: File;
  previewUrl: string | null;
  onAnalyze: () => void;
  onClear: () => void;
  lastError: string | null;
}) {
  const isPDF = file.type === "application/pdf";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={v2MotionTokens.spring}
        className="overflow-hidden rounded-3xl border border-border bg-muted/15"
      >
        <div className="flex min-h-[200px] items-center justify-center bg-card/40">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={file.name}
              width={1200}
              height={800}
              unoptimized
              className="max-h-[380px] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-14">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/50">
                <FileScan className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Documento PDF listo para analizar</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatFileSize(file.size)} · {isPDF ? "PDF" : file.type.split("/")[1]?.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Cambiar archivo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition hover:text-foreground"
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

      {lastError && <RecoveryNotice message={lastError} onRetry={onAnalyze} actionLabel="Reintentar análisis" />}

      <p className="text-center text-xs text-muted-foreground">
        La IA nunca guarda automáticamente. Siempre revisás y confirmás antes de importar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Processing view — cinematic sequential steps
// ---------------------------------------------------------------------------

function ProcessingView({ isSlow, onCancel }: { isSlow: boolean; onCancel: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (currentStep >= PROCESSING_STEPS.length - 1) return;
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 1400);
    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-10">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-xl" />
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-28 w-28 items-center justify-center rounded-full border border-teal-400/20 bg-teal-400/[0.07] shadow-[0_0_80px_rgba(45,212,191,0.18)]"
        >
          <motion.div
            animate={shouldReduceMotion ? {} : { rotate: 360 }}
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
                {pending && <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  done && "text-teal-400",
                  active && "text-foreground",
                  pending && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-3 text-center">
        <p className="text-xs text-muted-foreground">
          {isSlow
            ? "Está tardando más de lo normal. Podés cancelar y reintentar sin perder el archivo."
            : "Esto puede tomar unos segundos…"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border bg-muted/30 px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirming view
// ---------------------------------------------------------------------------

function ConfirmingView({ count }: { count: number }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-teal-400/15 blur-lg"
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted/40">
          <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
        </div>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold text-foreground">Guardando transacciones</p>
        <p className="text-sm text-muted-foreground">
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
      textClass: "text-muted-foreground",
      borderClass: "border-border",
      bgClass: "bg-muted/20",
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
    <div className="flex flex-col items-center gap-6 py-3">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={v2MotionTokens.spring}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-xl" />
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
        <p className="text-2xl font-semibold text-foreground">
          {imported === 0
            ? "Sin transacciones importadas"
            : `Listo. ${imported} movimiento${imported !== 1 ? "s" : ""} guardado${imported !== 1 ? "s" : ""}.`}
        </p>
        <p className="text-sm text-muted-foreground">
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
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
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

function RecoveryNotice({
  message,
  onRetry,
  actionLabel,
}: {
  message: string;
  onRetry: () => void;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <p className="text-sm leading-5 text-amber-500">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 text-sm font-semibold text-amber-500 transition hover:bg-amber-200/15"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
