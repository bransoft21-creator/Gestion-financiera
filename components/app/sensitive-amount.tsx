"use client";

import { useHideAmounts } from "@/hooks/use-hide-amounts";
import { cn } from "@/lib/utils";

const MONEY_TEXT_PATTERN = /([+-]?\s*(?:ARS|USD)?\s*\$[\s\u00a0]?-?[\d.,]+|[+-]?\s*[\d.,]+\s*(?:ARS|USD|pesos|d[oó]lares))/gi;
const MONEY_TEXT_VALUE = /^[+-]?\s*(?:ARS|USD)?\s*\$[\s\u00a0]?-?[\d.,]+$|^[+-]?\s*[\d.,]+\s*(?:ARS|USD|pesos|d[oó]lares)$/i;

type SensitiveAmountProps = {
  value: string;
  className?: string;
  hiddenLabel?: string;
};

export function SensitiveAmount({ value, className, hiddenLabel = "Monto oculto" }: SensitiveAmountProps) {
  const hidden = useHideAmounts();
  return (
    <span
      className={cn("inline-block align-baseline", className)}
      aria-label={hidden ? hiddenLabel : undefined}
      suppressHydrationWarning
    >
      <span
        aria-hidden={hidden ? true : undefined}
        className={cn(
          "inline-block max-w-full transition-[filter,opacity] duration-200",
          hidden && "select-none blur-[5px] opacity-70",
        )}
      >
        {value}
      </span>
    </span>
  );
}

export function SensitiveText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(MONEY_TEXT_PATTERN).filter(Boolean);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        MONEY_TEXT_VALUE.test(part) ? (
          <SensitiveAmount key={`${part}-${index}`} value={part} />
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}

export function formatSensitiveMoney(
  value: number,
  hidden: boolean,
  currency: "ARS" | "USD" = "ARS",
): string {
  if (hidden) return "Monto oculto";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
