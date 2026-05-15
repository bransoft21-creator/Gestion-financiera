"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { captureClientError, trackProductEvent } from "@/lib/observability/client";
import {
  SMART_IMPORT_ALLOWED_TYPES,
  SMART_IMPORT_SLOW_MS,
  SMART_IMPORT_TIMEOUT_MS,
} from "./constants";
import { fileSizeBucket } from "./utils";
import type {
  CandidateState,
  ImportCandidate,
  ImportMetadata,
  Step,
  WorkspaceAccount,
} from "./types";

type Options = {
  householdId: string;
  accounts: WorkspaceAccount[];
};

export function useSmartImport({ householdId, accounts }: Options) {
  const [step, setStep] = useState<Step>("upload");
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [duplicatesAvoided, setDuplicatesAvoided] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSlowProcessing, setIsSlowProcessing] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hadErrorRef = useRef(false);

  const selected = useMemo(() => candidates.filter((c) => c.selected), [candidates]);

  const revokePreviewUrl = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!SMART_IMPORT_ALLOWED_TYPES.includes(file.type as (typeof SMART_IMPORT_ALLOWED_TYPES)[number])) {
        toast.error("Formato no soportado. Usá JPG, PNG, WEBP o PDF.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("El archivo es demasiado grande. Máximo 10 MB.");
        return;
      }
      revokePreviewUrl();
      setSelectedFile(file);
      setLastError(null);
      trackProductEvent(
        "smart_import_file_selected",
        { fileType: file.type || "unknown", fileSizeBucket: fileSizeBucket(file.size) },
        "smart-import",
      );
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        previewUrlRef.current = url;
        setFilePreviewUrl(url);
      } else {
        setFilePreviewUrl(null);
      }
    },
    [revokePreviewUrl],
  );

  const handleClearFile = useCallback(() => {
    revokePreviewUrl();
    setSelectedFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [revokePreviewUrl]);

  const processSelectedFile = useCallback(async () => {
    if (!selectedFile) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const message = "No hay conexión. Volvé a intentar cuando estés online.";
      setLastError(message);
      toast.error(message);
      return;
    }

    if (hadErrorRef.current) {
      trackProductEvent("smart_import_retry", {}, "smart-import");
      hadErrorRef.current = false;
    }

    abortRef.current?.abort("superseded");
    const controller = new AbortController();
    abortRef.current = controller;
    setLastError(null);
    setIsSlowProcessing(false);
    setStep("processing");

    const slowTimer = window.setTimeout(() => {
      if (abortRef.current !== controller) return;
      setIsSlowProcessing(true);
      trackProductEvent("smart_import_slow", { fileType: selectedFile.type || "unknown" }, "smart-import");
    }, SMART_IMPORT_SLOW_MS);
    const timeoutTimer = window.setTimeout(() => {
      controller.abort("timeout");
    }, SMART_IMPORT_TIMEOUT_MS);

    try {
      trackProductEvent(
        "smart_import_started",
        { fileType: selectedFile.type || "unknown", fileSizeBucket: fileSizeBucket(selectedFile.size) },
        "smart-import",
      );
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("householdId", householdId);

      const res = await fetch("/api/ai/smart-import", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Error al procesar el documento.");
      }

      const { data } = (await res.json()) as {
        data: { candidates: ImportCandidate[]; metadata: ImportMetadata };
      };
      if (abortRef.current !== controller) return;

      const today = new Date().toISOString().slice(0, 10);
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
      trackProductEvent(
        "smart_import_succeeded",
        { candidateCount: stateList.length, status: data.metadata.warnings.length > 0 ? "partial" : "ok" },
        "smart-import",
      );
      trackProductEvent("smart_import_review_started", { candidateCount: stateList.length }, "smart-import");
      setStep("review");
    } catch (err) {
      if (abortRef.current !== controller) return;

      const wasAborted = controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError");
      const abortReason = controller.signal.reason;
      const message = wasAborted
        ? abortReason === "user_cancel"
          ? "Cancelamos la importación. Podés volver a intentarlo sin perder el archivo."
          : "El análisis del PDF tardó más de lo esperado. Podés volver a intentarlo sin perder el archivo."
        : err instanceof Error
          ? err.message
          : "No pudimos completar la importación esta vez.";
      setLastError(message);
      if (!wasAborted) hadErrorRef.current = true;
      trackProductEvent(
        wasAborted ? "smart_import_cancelled" : "smart_import_failed",
        { reason: wasAborted ? String(abortReason ?? "timeout_or_cancel") : "request_failed" },
        "smart-import",
      );
      if (!wasAborted) captureClientError(err, "smart-import", { reason: "process_failed" });
      toast.error(message);
      setStep("upload");
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsSlowProcessing(false);
      }
    }
  }, [selectedFile, householdId, accounts]);

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort("user_cancel");
    trackProductEvent("smart_import_cancelled", { reason: "user_cancel" }, "smart-import");
  }, []);

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

      trackProductEvent("smart_import_confirm_started", { selectedCount: toImport.length }, "smart-import");

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

      trackProductEvent(
        "smart_import_confirm_succeeded",
        {
          selectedCount: toImport.length,
          createdCount: created,
          errorCount: errors.length,
          status: errors.length > 0 ? "partial" : "ok",
        },
        "smart-import",
      );
      setImportedCount(created);
      setDiscardedCount(notSelected.length);
      setDuplicatesAvoided(dupsAvoided.length);
      setStep("done");
    } catch (err) {
      trackProductEvent("smart_import_confirm_failed", { reason: "save_failed" }, "smart-import");
      captureClientError(err, "smart-import", { reason: "confirm_failed" });
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
      setStep("review");
    }
  }, [householdId, candidates]);

  const reset = useCallback(() => {
    revokePreviewUrl();
    abortRef.current?.abort("reset");
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setCandidates([]);
    setMetadata(null);
    setImportedCount(0);
    setDiscardedCount(0);
    setDuplicatesAvoided(0);
    setLastError(null);
    setIsSlowProcessing(false);
    setStep("upload");
  }, [revokePreviewUrl]);

  useEffect(
    () => () => {
      abortRef.current?.abort("unmount");
      revokePreviewUrl();
    },
    [revokePreviewUrl],
  );

  return {
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
    handleFileSelect,
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
  };
}
