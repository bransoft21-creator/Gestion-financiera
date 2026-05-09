import { NextRequest } from "next/server";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { argentinaDayStartFromInput } from "@/lib/dates";
import { exportTransactions } from "@/server/services/transactions";

export const runtime = "nodejs";

const transactionTypeValues = Object.values(TransactionType) as [TransactionType, ...TransactionType[]];
const filterDateSchema = z.preprocess(argentinaDayStartFromInput, z.date());

const exportSchema = z.object({
  householdId: z.string().min(1),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  type: z.enum(transactionTypeValues).optional(),
  from: filterDateSchema.optional(),
  to: filterDateSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

const typeLabels: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  ADJUSTMENT: "Ajuste",
  DEBT_PAYMENT: "Pago de deuda",
  GOAL_CONTRIBUTION: "Aporte a meta",
  INVESTMENT: "Inversión",
};

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = exportSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const items = await exportTransactions(userProfile.id, input);

    const header = ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Moneda", "Monto", "Notas"];
    const rows = items.map((t) => [
      t.occurredAt.toISOString().slice(0, 10),
      typeLabels[t.type],
      t.description ?? "",
      t.category?.name ?? "",
      t.account.name,
      t.currency,
      t.type === "INCOME" ? Number(t.amount).toFixed(2) : `-${Number(t.amount).toFixed(2)}`,
      t.notes ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
      .join("\n");

    const filename = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
