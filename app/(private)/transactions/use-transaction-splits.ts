"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SharedHouseholdOption, SplitMode } from "./types";

export function useTransactionSplits({
  selectedHousehold,
  sharedHouseholdId,
  amount,
}: {
  selectedHousehold: SharedHouseholdOption | undefined;
  sharedHouseholdId: string;
  amount: string;
}) {
  const [splitMode, setSplitMode] = useState<SplitMode>("EQUAL");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const overrideValuesRef = useRef<Record<string, string> | null>(null);

  const splitTotal = useMemo(
    () => Object.values(splitValues).reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
    [splitValues],
  );

  const splitIsValid = useMemo(() => {
    if (splitMode === "EQUAL") return true;
    if (splitMode === "PERCENTAGE") return Math.abs(splitTotal - 100) <= 0.5;
    return Math.abs(splitTotal - (parseFloat(amount) || 0)) <= 0.5;
  }, [splitMode, splitTotal, amount]);

  useEffect(() => {
    if (!selectedHousehold?.members.length || !sharedHouseholdId) return;

    // When loading an existing transaction for editing, use the stored values.
    if (overrideValuesRef.current !== null) {
      setSplitValues(overrideValuesRef.current);
      overrideValuesRef.current = null;
      return;
    }

    const members = selectedHousehold.members;
    const values: Record<string, string> = {};
    if (splitMode === "PERCENTAGE") {
      const equalPct = (100 / members.length).toFixed(1);
      members.forEach((member) => {
        values[member.userProfileId] = equalPct;
      });
    } else if (splitMode === "CUSTOM_AMOUNT") {
      members.forEach((member) => {
        values[member.userProfileId] = "";
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSplitValues(values);
  }, [selectedHousehold, sharedHouseholdId, splitMode]);

  function resetSplits() {
    setSplitMode("EQUAL");
    setSplitValues({});
    overrideValuesRef.current = null;
  }

  function loadFromSharedTransaction(
    mode: SplitMode,
    participants: Array<{ userId: string | null; percentage: string | null; amount: string }>,
  ) {
    const values: Record<string, string> = {};
    if (mode === "PERCENTAGE") {
      for (const p of participants) {
        if (p.userId) values[p.userId] = p.percentage ?? "0";
      }
    } else if (mode === "CUSTOM_AMOUNT") {
      for (const p of participants) {
        if (p.userId) values[p.userId] = p.amount;
      }
    }
    overrideValuesRef.current = values;
    setSplitMode(mode);
  }

  return {
    splitMode,
    splitValues,
    splitTotal,
    splitIsValid,
    setSplitMode,
    setSplitValues,
    resetSplits,
    loadFromSharedTransaction,
  };
}
