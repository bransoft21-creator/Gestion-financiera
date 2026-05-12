/**
 * Activity Center — server-side service.
 * Manages persistent ActivityItem records: signals, AI insights, reminders, system events.
 * Financial Intelligence remains the brain; this service is the activity UI layer.
 */

import { ActivityTone, ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeWeeklyComparison,
  computeWeeklyMetrics,
  getISOWeekKey,
  getWeekWindow,
} from "@/lib/finance/financial-analytics";
import { generateWeeklySignals, type SignalSeverity } from "@/lib/finance/financial-signals";

export type { ActivityType, ActivityTone };

export interface UpsertActivityParams {
  userId: string;
  type: ActivityType;
  source?: string;
  tone: ActivityTone;
  priority?: number;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey: string;
  periodKey?: string;
  actionLabel?: string;
  actionLink?: string;
}

export type ActivityFilter = "all" | "important" | "positive" | "pending" | "archived";

/** Creates or updates an activity item. Idempotent — safe to call repeatedly. */
export async function upsertActivity(params: UpsertActivityParams) {
  const {
    userId, type, tone, priority = 0,
    source = "system", title, body, metadata, dedupeKey, periodKey,
    actionLabel, actionLink,
  } = params;

  return prisma.activityItem.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    create: {
      userId, type, source, tone, priority,
      title, body, metadata, dedupeKey, periodKey,
      actionLabel, actionLink,
    },
    update: {
      // Update content if signals change, but preserve read/dismiss state
      source, tone, priority, title, body, metadata,
      actionLabel, actionLink,
    },
  });
}

/** Lists activity items for a user, applying filter. Excludes dismissed items. */
export async function listActivities(params: {
  userId: string;
  filter?: ActivityFilter;
  limit?: number;
}) {
  const { userId, filter = "all", limit = 40 } = params;

  const where: Prisma.ActivityItemWhereInput = { userId };

  if (filter === "archived") {
    where.dismissedAt = { not: null };
  } else {
    where.dismissedAt = null;
  }

  if (filter === "pending") {
    where.readAt = null;
    where.resolvedAt = null;
  }
  if (filter === "positive")  where.tone = ActivityTone.positive;
  if (filter === "important") where.priority = { gte: 1 };

  return prisma.activityItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Returns count of unread, non-dismissed activity items. */
export async function countUnreadActivities(userId: string): Promise<number> {
  return prisma.activityItem.count({
    where: { userId, readAt: null, dismissedAt: null },
  });
}

export async function markActivityRead(userId: string, id: string) {
  await prisma.activityItem.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function dismissActivity(userId: string, id: string) {
  await prisma.activityItem.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
}

export async function resolveActivity(userId: string, id: string) {
  await prisma.activityItem.updateMany({
    where: { id, userId, resolvedAt: null },
    data: { resolvedAt: new Date(), readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await prisma.activityItem.updateMany({
    where: { userId, readAt: null, dismissedAt: null },
    data: { readAt: new Date() },
  });
}

// ── Financial signal generation ─────────────────────────────────────────────

/**
 * Converts existing deterministic weekly signals into persistent activity items.
 * No AI calls. Safe to run on page load because dedupe keys make it idempotent.
 */
export async function upsertWeeklySignalActivities(params: {
  userId: string;
  householdId: string;
}) {
  const { userId, householdId } = params;
  const now = new Date();
  const currentWindow = getWeekWindow(now);
  const prevWeekDate = new Date(currentWindow.start);
  prevWeekDate.setDate(prevWeekDate.getDate() - 1);
  const prevWindow = getWeekWindow(prevWeekDate);
  const periodKey = getISOWeekKey(now);

  const txQuery = (start: Date, end: Date) =>
    prisma.transaction.findMany({
      where: {
        householdId,
        occurredAt: { gte: start, lte: end },
        status: "CONFIRMED",
        type: { in: ["INCOME", "EXPENSE"] },
        deletedAt: null,
      },
      include: {
        category: { select: { name: true, type: true } },
        account: { select: { name: true, type: true } },
      },
    });

  const [currentTxs, previousTxs] = await Promise.all([
    txQuery(currentWindow.start, currentWindow.end),
    txQuery(prevWindow.start, prevWindow.end),
  ]);

  const currentMetrics = computeWeeklyMetrics(currentTxs);
  if (!currentMetrics.hasData) return;

  const previousMetrics = computeWeeklyMetrics(previousTxs);
  const comparison = computeWeeklyComparison(currentMetrics, previousMetrics);
  const signals = generateWeeklySignals(currentMetrics, comparison);

  await Promise.all(signals.map((signal) => {
    const copy = signalCopy(signal.id, signal.label);
    return upsertActivity({
      userId,
      type: ActivityType.SIGNAL,
      source: "financial-signals",
      tone: toneFromSignal(signal.severity),
      priority: signal.severity === "warning" ? 1 : 0,
      title: copy.title,
      body: copy.body,
      metadata: {
        signalId: signal.id,
        severity: signal.severity,
        rawLabel: signal.label,
      },
      dedupeKey: `signal-${periodKey}-${signal.id}`,
      periodKey,
      actionLabel: copy.actionLabel,
      actionLink: copy.actionLink,
    });
  }));
}

// ── Reminder generation ─────────────────────────────────────────────────────

/**
 * Computes lightweight monthly metrics and upserts REMINDER activity items.
 * Called server-side when the activity center loads.
 * Cheap: 3 aggregation queries + 2–3 upserts.
 */
export async function upsertReminderActivities(params: {
  userId: string;
  householdId: string;
}) {
  const { userId, householdId } = params;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;

  // Argentina timezone offset (UTC-3): start/end of current calendar month in UTC
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0)); // 00:00 ART
  const monthEnd   = new Date(Date.UTC(year, month,     0, 26, 59, 59, 999)); // ~23:59 ART last day

  const [incomeAgg, expensesAgg, debtsAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        householdId,
        type: "INCOME",
        status: "CONFIRMED",
        occurredAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        householdId,
        type: "EXPENSE",
        status: "CONFIRMED",
        occurredAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    prisma.debt.aggregate({
      where: { householdId, status: "ACTIVE", deletedAt: null },
      _sum: { outstandingAmount: true },
    }),
  ]);

  const income   = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expensesAgg._sum.amount ?? 0);
  const debt     = Number(debtsAgg._sum.outstandingAmount ?? 0);

  const upserts: Promise<unknown>[] = [];

  // Budget pressure warning (≥ 80% of income spent)
  if (income > 0 && expenses / income >= 0.80) {
    const pct = Math.round((expenses / income) * 100);
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.warning,
        priority: 1,
        title: "Gastos cerca del límite del mes",
        body: `Ya usaste el ${pct}% de tus ingresos de ${MONTH_NAMES[month - 1]}.`,
        dedupeKey: `reminder-budget-${periodKey}`,
        periodKey,
        actionLabel: "Ver movimientos",
        actionLink: "/transactions",
      }),
    );
  } else if (income > 0 && expenses / income < 0.55) {
    // Positive: good spending discipline
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.positive,
        priority: 0,
        title: "Buen ritmo de gasto este mes",
        body: `Gastaste menos del 55% de tus ingresos de ${MONTH_NAMES[month - 1]}.`,
        dedupeKey: `reminder-budget-good-${periodKey}`,
        periodKey,
        actionLabel: "Ver dashboard",
        actionLink: "/dashboard",
      }),
    );
  }

  // Outstanding debt reminder (monthly, neutral)
  if (debt > 0) {
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.neutral,
        priority: 0,
        title: "Deuda activa registrada",
        body: formatARS(debt) + " de deuda activa este mes.",
        dedupeKey: `reminder-debt-${periodKey}`,
        periodKey,
        actionLabel: "Ver deudas",
        actionLink: "/debts",
      }),
    );
  }

  if (upserts.length > 0) {
    await Promise.all(upserts);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function toneFromSignal(severity: SignalSeverity): ActivityTone {
  if (severity === "positive") return ActivityTone.positive;
  if (severity === "warning") return ActivityTone.warning;
  return ActivityTone.neutral;
}

function signalCopy(signalId: string, label: string) {
  const defaults = {
    title: label,
    body: "Lo marcamos para que puedas mirarlo con calma cuando tengas un minuto.",
    actionLabel: "Ver movimientos",
    actionLink: "/transactions",
  };

  const bySignal: Record<string, typeof defaults> = {
    EXPENSES_DOWN: {
      title: "Buen ritmo de gasto semanal",
      body: label + ". Conviene mirar qué ayudó a sostener ese cambio.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    EXPENSES_UP: {
      title: "Tus gastos crecieron esta semana",
      body: label + ". No es una alarma: es una señal para revisar el contexto.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    STABLE_WEEK: {
      title: "Semana estable",
      body: label + ". La constancia también es información financiera útil.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    WEEKEND_SPIKE: {
      title: "El fin de semana concentró gasto",
      body: label + ". Puede valer la pena revisar esos movimientos juntos.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    DELIVERY_HIGH: {
      title: "Una categoría tomó más peso",
      body: label + ". Te lo dejamos a mano para decidir si sigue alineado con tu mes.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    TRANSPORT_GROWTH: {
      title: "Transporte viene aumentando",
      body: label + ". Revisarlo ahora puede evitar que se vuelva ruido de fin de mes.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    GOOD_SAVINGS: {
      title: "Buen ritmo de ahorro",
      body: label + ". Es una buena base para sostener el mes sin ajustar de más.",
      actionLabel: "Ver objetivos",
      actionLink: "/goals",
    },
    LOW_SAVINGS: {
      title: "Ahorro semanal bajo",
      body: label + ". Mirarlo temprano ayuda a corregir sin presión.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    CATEGORY_DOMINANT: {
      title: "Gasto concentrado en una categoría",
      body: label + ". Puede ser normal, pero conviene tenerlo visible.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    CREDIT_HEAVY: {
      title: "Uso alto de crédito",
      body: label + ". Te lo mostramos como contexto para próximos cierres.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
  };

  return bySignal[signalId] ?? defaults;
}
