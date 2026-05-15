"use client";

import { useEffect, useMemo, useState } from "react";
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
  }

  return {
    splitMode,
    splitValues,
    splitTotal,
    splitIsValid,
    setSplitMode,
    setSplitValues,
    resetSplits,
  };
}
