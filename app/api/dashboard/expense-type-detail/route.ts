import { NextRequest } from "next/server";
import { z } from "zod";
import { ExpenseType, TransactionStatus, TransactionType } from "@prisma/client";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { getPrimaryHousehold } from "../../../../server/services/workspace";
import { assertHouseholdAccess } from "../../../../server/services/households";
import { prisma } from "../../../../lib/prisma";
import { argentinaMonthRangeUtc } from "../../../../lib/dates";

export const runtime = "nodejs";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  expenseGroup: z.enum(["FIXED", "VARIABLE", "EXTRAORDINARY", "UNCLASSIFIED"]),
});

export type ExpenseTypeDetailTransaction = {
  id: string;
  description: string | null;
  amount: string;
  currency: string;
  occurredAt: string;
  expenseType: string | null;
  categoryId: string | null;
  categoryName: string | null;
  accountName: string;
};

export type ExpenseTypeDetailResponse = {
  transactions: ExpenseTypeDetailTransaction[];
};

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);
    const { year, month, expenseGroup } = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    await assertHouseholdAccess(userProfile.id, household.id);

    const { start, end } = argentinaMonthRangeUtc(year, month);

    const expenseTypeWhere =
      expenseGroup === "UNCLASSIFIED"
        ? { expenseType: null }
        : { expenseType: expenseGroup as ExpenseType };

    const rows = await prisma.transaction.findMany({
      where: {
        householdId: household.id,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
        type: TransactionType.EXPENSE,
        occurredAt: { gte: start, lt: end },
        ...expenseTypeWhere,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
        occurredAt: true,
        expenseType: true,
        category: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    });

    const transactions: ExpenseTypeDetailTransaction[] = rows.map((row) => ({
      id: row.id,
      description: row.description,
      amount: String(row.amount),
      currency: row.currency,
      occurredAt: row.occurredAt.toISOString(),
      expenseType: row.expenseType ?? null,
      categoryId: row.category?.id ?? null,
      categoryName: row.category?.name ?? null,
      accountName: row.account.name,
    }));

    return ok({ transactions } satisfies ExpenseTypeDetailResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
