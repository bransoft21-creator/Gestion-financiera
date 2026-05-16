import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";

const MERCHANT_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /pedidos\s*ya|rappi|ifood|glovo|uber\s*eats/i, hint: "Delivery" },
  { pattern: /\buber\b(?!\s*eats)|cabify|taxi|remis/i, hint: "Transporte" },
  { pattern: /farmacity|farmacenter|\bfarma\b|botica|drogueria|droguería/i, hint: "Salud" },
  { pattern: /carrefour|\bcoto\b|\bdia\b|jumbo|walmart|disco|\bvea\b|changomas|maxiconsumo/i, hint: "Supermercado" },
  { pattern: /netflix|spotify|disney|hbo|prime\s*video|youtube\s*premium|apple\s*(tv|music)|flow\s*tv/i, hint: "Suscripciones" },
  { pattern: /mcdonald|burger\s*king|\bkfc\b|pizza\b|sushi|restaurante|\bcafe\b|parrilla|heladeria/i, hint: "Restaurantes" },
  { pattern: /\bgym\b|gimnasio|\bfitness\b|yoga|pilates|crossfit/i, hint: "Deporte" },
  { pattern: /\bypf\b|axion|petrobras|nafta\b|combustible|shell\s*station/i, hint: "Combustible" },
  { pattern: /movistar|claro|personal\s*mobile|telecom|fibertel|cablevision|directv/i, hint: "Servicios" },
  { pattern: /edesur|edenor|\baysa\b|metrogas|naturgy/i, hint: "Servicios" },
  { pattern: /mercado\s*libre|tienda\s*nube|\bamazon\b/i, hint: "Compras Online" },
  { pattern: /ferreteria|ferretería|pintureria|maderería|corralón/i, hint: "Hogar" },
  { pattern: /libreria|librería|educacion|colegio|universidad|\bcurso\b/i, hint: "Educación" },
];

function applyMerchantHint(description: string): string | null {
  for (const { pattern, hint } of MERCHANT_HINTS) {
    if (pattern.test(description)) return hint;
  }
  return null;
}

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .trim()
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(la, lb) / maxLen;
}

export type QualitySignals = {
  uncategorizedCount: number;
  similarCategoryPairs: number;
  unusedCategoryCount: number;
  frequentGroupCount: number;
};

export type UncategorizedTransaction = {
  id: string;
  description: string | null;
  amount: string;
  currency: string;
  occurredAt: string;
  type: string;
  accountName: string;
  suggestedHint: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
};

export type FrequentDescription = {
  key: string;
  examples: string[];
  count: number;
  totalAmount: string;
  currency: string;
  transactionIds: string[];
  suggestedHint: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
};

export type SimilarCategoryPair = {
  a: { id: string; name: string; type: string; transactionCount: number };
  b: { id: string; name: string; type: string; transactionCount: number };
  similarity: number;
};

export type UnusedCategory = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  createdAt: string;
};

export async function getQualitySignals(userProfileId: string, householdId: string): Promise<QualitySignals> {
  await assertHouseholdAccess(userProfileId, householdId);

  const [uncategorizedCount, categories, uncategorizedDescs] = await Promise.all([
    prisma.transaction.count({
      where: { householdId, deletedAt: null, status: { not: "CANCELED" }, categoryId: null, type: { in: ["EXPENSE", "INCOME"] } },
    }),
    prisma.category.findMany({
      where: { householdId, deletedAt: null, isArchived: false },
      select: { id: true, name: true, type: true, _count: { select: { transactions: { where: { deletedAt: null, status: { not: "CANCELED" } } } } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { householdId, deletedAt: null, status: { not: "CANCELED" }, categoryId: null, type: { in: ["EXPENSE", "INCOME"] }, description: { not: null } },
      select: { description: true },
      take: 500,
    }),
  ]);

  // similar pairs per type
  let similarCount = 0;
  const catsByType: Record<string, typeof categories> = {};
  for (const cat of categories) {
    if (!catsByType[cat.type]) catsByType[cat.type] = [];
    catsByType[cat.type].push(cat);
  }
  for (const cats of Object.values(catsByType)) {
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        if (nameSimilarity(cats[i].name, cats[j].name) >= 0.75) similarCount++;
      }
    }
  }

  // unused categories
  const unusedCategoryCount = categories.filter((c) => c._count.transactions === 0).length;

  // frequent uncategorized groups
  const descMap = new Map<string, number>();
  for (const t of uncategorizedDescs) {
    if (!t.description) continue;
    const key = normalizeDescription(t.description);
    if (!key) continue;
    descMap.set(key, (descMap.get(key) ?? 0) + 1);
  }
  const frequentGroupCount = Array.from(descMap.values()).filter((c) => c >= 2).length;

  return { uncategorizedCount, similarCategoryPairs: similarCount, unusedCategoryCount, frequentGroupCount };
}

export async function getUncategorizedTransactions(userProfileId: string, householdId: string): Promise<UncategorizedTransaction[]> {
  await assertHouseholdAccess(userProfileId, householdId);

  const [rows, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, deletedAt: null, status: { not: "CANCELED" }, categoryId: null, type: { in: ["EXPENSE", "INCOME"] } },
      select: { id: true, description: true, amount: true, currency: true, occurredAt: true, type: true, account: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.category.findMany({
      where: { householdId, deletedAt: null, isArchived: false },
      select: { id: true, name: true },
    }),
  ]);

  return rows.map((t) => {
    const hint = t.description ? applyMerchantHint(t.description) : null;
    const matched = hint ? categories.find((c) => c.name.toLowerCase().includes(hint.toLowerCase())) ?? null : null;
    return {
      id: t.id,
      description: t.description ?? null,
      amount: t.amount.toString(),
      currency: t.currency,
      occurredAt: t.occurredAt.toISOString(),
      type: t.type,
      accountName: t.account.name,
      suggestedHint: hint,
      suggestedCategoryId: matched?.id ?? null,
      suggestedCategoryName: matched?.name ?? null,
    };
  });
}

export async function getFrequentUncategorizedDescriptions(userProfileId: string, householdId: string): Promise<FrequentDescription[]> {
  await assertHouseholdAccess(userProfileId, householdId);

  const [uncategorized, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, deletedAt: null, status: { not: "CANCELED" }, categoryId: null, type: { in: ["EXPENSE", "INCOME"] }, description: { not: null } },
      select: { id: true, description: true, amount: true, currency: true },
      take: 500,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.category.findMany({
      where: { householdId, deletedAt: null, isArchived: false },
      select: { id: true, name: true },
    }),
  ]);

  const groups = new Map<string, { examples: Set<string>; ids: string[]; totalAmount: number; currency: string }>();

  for (const t of uncategorized) {
    if (!t.description) continue;
    const key = `${normalizeDescription(t.description)}|${t.currency}`;
    const normalized = key.split("|")[0];
    if (!normalized) continue;
    const existing = groups.get(key);
    const amount = parseFloat(t.amount.toString());
    if (existing) {
      existing.examples.add(t.description!);
      existing.ids.push(t.id);
      existing.totalAmount += amount;
    } else {
      groups.set(key, { examples: new Set([t.description!]), ids: [t.id], totalAmount: amount, currency: t.currency });
    }
  }

  const result: FrequentDescription[] = [];
  for (const [key, group] of groups.entries()) {
    if (group.ids.length < 2) continue;
    const normalizedKey = key.split("|")[0];
    const firstExample = Array.from(group.examples)[0];
    const hint = applyMerchantHint(firstExample);
    const matched = hint ? categories.find((c) => c.name.toLowerCase().includes(hint.toLowerCase())) ?? null : null;
    result.push({
      key: normalizedKey,
      examples: Array.from(group.examples).slice(0, 3),
      count: group.ids.length,
      totalAmount: group.totalAmount.toFixed(2),
      currency: group.currency,
      transactionIds: group.ids,
      suggestedHint: hint,
      suggestedCategoryId: matched?.id ?? null,
      suggestedCategoryName: matched?.name ?? null,
    });
  }

  return result.sort((a, b) => b.count - a.count).slice(0, 20);
}

export async function getSimilarCategories(userProfileId: string, householdId: string): Promise<SimilarCategoryPair[]> {
  await assertHouseholdAccess(userProfileId, householdId);

  const categories = await prisma.category.findMany({
    where: { householdId, deletedAt: null, isArchived: false },
    select: { id: true, name: true, type: true, _count: { select: { transactions: { where: { deletedAt: null, status: { not: "CANCELED" } } } } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const pairs: SimilarCategoryPair[] = [];
  const catsByType: Record<string, typeof categories> = {};
  for (const cat of categories) {
    if (!catsByType[cat.type]) catsByType[cat.type] = [];
    catsByType[cat.type].push(cat);
  }

  for (const cats of Object.values(catsByType)) {
    for (let i = 0; i < cats.length && pairs.length < 15; i++) {
      for (let j = i + 1; j < cats.length && pairs.length < 15; j++) {
        const sim = nameSimilarity(cats[i].name, cats[j].name);
        if (sim >= 0.75 && sim < 1) {
          pairs.push({
            a: { id: cats[i].id, name: cats[i].name, type: cats[i].type, transactionCount: cats[i]._count.transactions },
            b: { id: cats[j].id, name: cats[j].name, type: cats[j].type, transactionCount: cats[j]._count.transactions },
            similarity: Math.round(sim * 100),
          });
        }
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

export async function getUnusedCategories(userProfileId: string, householdId: string): Promise<UnusedCategory[]> {
  await assertHouseholdAccess(userProfileId, householdId);

  const categories = await prisma.category.findMany({
    where: { householdId, deletedAt: null, isArchived: false },
    select: { id: true, name: true, type: true, color: true, createdAt: true, _count: { select: { transactions: { where: { deletedAt: null, status: { not: "CANCELED" } } } } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return categories
    .filter((c) => c._count.transactions === 0)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color, createdAt: c.createdAt.toISOString() }))
    .slice(0, 30);
}

export async function bulkCategorizeTransactions(
  userProfileId: string,
  input: { householdId: string; transactionIds: string[]; categoryId: string },
): Promise<{ updated: number }> {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, householdId: input.householdId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new Error("Category not found");

  const result = await prisma.transaction.updateMany({
    where: { id: { in: input.transactionIds }, householdId: input.householdId, deletedAt: null },
    data: { categoryId: input.categoryId },
  });

  return { updated: result.count };
}
