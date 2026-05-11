"use client";

import { useHideAmounts } from "@/hooks/use-hide-amounts";

const HIDDEN_PLACEHOLDER = "$••••";

type SensitiveAmountProps = {
  value: string;
  className?: string;
};

export function SensitiveAmount({ value, className }: SensitiveAmountProps) {
  const hidden = useHideAmounts();
  return (
    <span
      className={className}
      aria-label={hidden ? "Monto oculto" : undefined}
      suppressHydrationWarning
    >
      {hidden ? HIDDEN_PLACEHOLDER : value}
    </span>
  );
}

export function formatSensitiveMoney(
  value: number,
  hidden: boolean,
  currency: "ARS" | "USD" = "ARS",
): string {
  if (hidden) return HIDDEN_PLACEHOLDER;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
