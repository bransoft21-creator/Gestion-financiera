import { z } from "zod";

export const MAX_MONEY_AMOUNT = 999_999_999_999.99;

const MONEY_FORMAT_MESSAGE = "Usá un número válido con hasta 2 decimales.";
const MONEY_REQUIRED_MESSAGE = "Ingresá un monto.";
const MONEY_POSITIVE_MESSAGE = "Ingresá un monto mayor a cero.";
const MONEY_NONNEGATIVE_MESSAGE = "El monto no puede ser negativo.";
const MONEY_MAX_MESSAGE = "El monto es demasiado grande.";

type MoneyOptions = {
  allowNegative?: boolean;
  allowZero?: boolean;
  required?: boolean;
};

type MoneyParseResult =
  | { success: true; data: number | undefined }
  | { success: false; error: string };

export function parseMoneyInput(value: unknown, options: MoneyOptions = {}): MoneyParseResult {
  const { allowNegative = false, allowZero = false, required = true } = options;

  if (value == null || value === "") {
    return required ? { success: false, error: MONEY_REQUIRED_MESSAGE } : { success: true, data: undefined };
  }

  const raw = typeof value === "string" ? value.trim() : String(value);

  if (raw === "") {
    return required ? { success: false, error: MONEY_REQUIRED_MESSAGE } : { success: true, data: undefined };
  }

  const normalized = raw.replace(",", ".");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return { success: false, error: MONEY_FORMAT_MESSAGE };
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return { success: false, error: MONEY_FORMAT_MESSAGE };
  }

  if (!allowNegative && amount < 0) {
    return { success: false, error: MONEY_NONNEGATIVE_MESSAGE };
  }

  if (!allowZero && amount === 0) {
    return { success: false, error: MONEY_POSITIVE_MESSAGE };
  }

  if (Math.abs(amount) > MAX_MONEY_AMOUNT) {
    return { success: false, error: MONEY_MAX_MESSAGE };
  }

  return { success: true, data: amount };
}

export function moneySchema(options?: MoneyOptions) {
  return z
    .unknown()
    .transform((value, ctx) => {
      const parsed = parseMoneyInput(value, options);

      if (!parsed.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
        return z.NEVER;
      }

      return parsed.data;
    })
    .pipe(z.number());
}

export function optionalMoneySchema(options?: Omit<MoneyOptions, "required">) {
  return z
    .unknown()
    .transform((value, ctx) => {
      const parsed = parseMoneyInput(value, { ...options, required: false });

      if (!parsed.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
        return z.NEVER;
      }

      return parsed.data;
    })
    .pipe(z.number().optional());
}

export function nullableMoneySchema(options?: Omit<MoneyOptions, "required">) {
  return z
    .unknown()
    .transform((value, ctx) => {
      if (value === null) {
        return null;
      }

      const parsed = parseMoneyInput(value, { ...options, required: false });

      if (!parsed.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
        return z.NEVER;
      }

      return parsed.data;
    })
    .pipe(z.number().nullable().optional());
}
