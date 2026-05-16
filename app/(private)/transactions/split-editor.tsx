"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SharedHouseholdOption, SplitMode } from "./types";

export function SplitEditor({
  selectedHousehold,
  splitMode,
  splitValues,
  splitTotal,
  splitIsValid,
  amount,
  onModeChange,
  onValuesChange,
}: {
  selectedHousehold: SharedHouseholdOption | undefined;
  splitMode: SplitMode;
  splitValues: Record<string, string>;
  splitTotal: number;
  splitIsValid: boolean;
  amount: string;
  onModeChange: (mode: SplitMode) => void;
  onValuesChange: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  if (!selectedHousehold) return null;

  return (
    <>
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">¿Cómo se reparte?</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { value: "EQUAL", label: "Igual" },
              { value: "PERCENTAGE", label: "Por %" },
              { value: "CUSTOM_AMOUNT", label: "Por monto" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                splitMode === option.value
                  ? "border-teal-300/30 bg-teal-300/15 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {splitMode === "EQUAL" ? (
        <p className="text-xs text-muted-foreground">
          {selectedHousehold.members.length} miembros · partes iguales.
        </p>
      ) : null}

      {splitMode !== "EQUAL" ? (
        <div className="space-y-2">
          {selectedHousehold.members.map((member) => (
            <div key={member.userProfileId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {member.userProfile.fullName ?? member.userProfile.email}
              </span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={splitMode === "PERCENTAGE" ? 100 : undefined}
                  step={splitMode === "PERCENTAGE" ? "0.1" : "1"}
                  inputMode="decimal"
                  value={splitValues[member.userProfileId] ?? ""}
                  onChange={(event) =>
                    onValuesChange((prev) => ({
                      ...prev,
                      [member.userProfileId]: event.target.value,
                    }))
                  }
                  className={`v2-focus-ring h-9 rounded-xl border border-border bg-muted/40 px-3 text-base md:text-sm text-foreground outline-none ${splitMode === "PERCENTAGE" ? "w-24 pr-7" : "w-32"}`}
                />
                {splitMode === "PERCENTAGE" ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                ) : null}
              </div>
            </div>
          ))}
          <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${splitIsValid ? "bg-emerald-300/10 text-emerald-400" : "bg-amber-300/10 text-amber-200"}`}>
            {splitMode === "PERCENTAGE"
              ? `${splitTotal.toFixed(1)}% de 100%${splitIsValid ? " ✓" : " — debe sumar 100%"}`
              : `${splitTotal.toLocaleString("es-AR")} de ${parseFloat(amount || "0").toLocaleString("es-AR")}${splitIsValid ? " ✓" : " — debe sumar el total"}`}
          </div>
        </div>
      ) : null}
    </>
  );
}
