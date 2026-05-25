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
import { computeRealLiabilitySummary, toFiniteNumber } from "./financial-ledger";
import { traceFinancialSource } from "./financial-debug";

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

type ActivitySummary = {
  unreadCount: number;
  pendingCount: number;
};

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

export async function getActivitySummary(userId: string): Promise<ActivitySummary> {
  const [unreadCount, pendingCount] = await Promise.all([
    prisma.activityItem.count({
      where: { userId, readAt: null, dismissedAt: null },
    }),
    prisma.activityItem.count({
      where: { userId, resolvedAt: null, dismissedAt: null },
    }),
  ]);

  return { unreadCount, pendingCount };
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

/**
 * Removes old low-value signals from the active feed.
 * Reading means "seen"; resolving means "handled"; expiration means "no longer useful".
 */
export async function expireStaleActivities(userId: string) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const weeklyCutoff = new Date(now);
  weeklyCutoff.setDate(weeklyCutoff.getDate() - 21);
  const positiveCutoff = new Date(now);
  positiveCutoff.setDate(positiveCutoff.getDate() - 14);

  await Promise.all([
    prisma.activityItem.updateMany({
      where: {
        userId,
        source: "financial-signals",
        dismissedAt: null,
        createdAt: { lt: weeklyCutoff },
      },
      data: { dismissedAt: now, readAt: now },
    }),
    prisma.activityItem.updateMany({
      where: {
        userId,
        source: "financial-signals",
        tone: ActivityTone.positive,
        dismissedAt: null,
        createdAt: { lt: positiveCutoff },
      },
      data: { dismissedAt: now, readAt: now },
    }),
    prisma.activityItem.updateMany({
      where: {
        userId,
        source: "monthly-reminders",
        priority: { lt: 2 },
        dismissedAt: null,
        periodKey: { not: currentMonthKey },
      },
      data: { dismissedAt: now, readAt: now },
    }),
  ]);
}

async function resolveReminderIfPresent(userId: string, dedupeKey: string) {
  await prisma.activityItem.updateMany({
    where: {
      userId,
      dedupeKey,
      resolvedAt: null,
      dismissedAt: null,
    },
    data: { resolvedAt: new Date(), readAt: new Date() },
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

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [incomeAgg, expensesAgg, debts, accounts, upcomingRecurringCount] = await Promise.all([
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
    prisma.debt.findMany({
      where: {
        householdId,
        status: { in: ["ACTIVE", "PAUSED", "DEFAULTED"] },
        outstandingAmount: { gt: 0 },
        deletedAt: null,
      },
      select: { id: true, type: true, status: true, currency: true, outstandingAmount: true, nextDueDate: true },
    }),
    prisma.account.findMany({
      where: { householdId, deletedAt: null, isArchived: false },
      select: { id: true, type: true, currency: true, currentBalance: true, isArchived: true, deletedAt: true },
    }),
    prisma.recurringExpense.count({
      where: {
        householdId,
        isActive: true,
        nextDueDate: { gte: now, lte: nextWeek },
        deletedAt: null,
      },
    }),
  ]);

  const income   = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expensesAgg._sum.amount ?? 0);
  const budgetRatio = income > 0 ? expenses / income : 0;
  const liabilitySummary = computeRealLiabilitySummary(accounts, debts);
  const debt = liabilitySummary.liabilities;
  const hasOverdueDebt = debts.some((item) => item.nextDueDate && item.nextDueDate < now);
  traceFinancialSource({
    endpoint: "/api/activity",
    householdId,
    source: "monthly-reminders.debt <- computeRealLiabilitySummary.liabilities",
    computed: {
      debt,
      accountLiabilities: liabilitySummary.accountLiabilities,
      debtLiabilities: liabilitySummary.debtLiabilities,
    },
    accounts: accounts.filter((account) => toFiniteNumber(account.currentBalance) < 0),
    debts,
  });

  const upserts: Promise<unknown>[] = [];

  // Budget pressure warning (P0 if exceeded, P1 if approaching)
  if (income > 0 && budgetRatio >= 0.80) {
    const pct = Math.round(budgetRatio * 100);
    const exceeded = budgetRatio >= 1;
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.warning,
        priority: exceeded ? 2 : 1,
        title: exceeded ? "El mes quedó por encima de los ingresos" : "Gastos cerca del límite del mes",
        body: `Ya se usó el ${pct}% de los ingresos de ${MONTH_NAMES[month - 1]}. Te lo dejamos visible para revisar con contexto.`,
        dedupeKey: `reminder-budget-${periodKey}`,
        periodKey,
        actionLabel: "Ver movimientos",
        actionLink: "/transactions",
      }),
      resolveReminderIfPresent(userId, `reminder-budget-good-${periodKey}`),
    );
  } else {
    upserts.push(resolveReminderIfPresent(userId, `reminder-budget-${periodKey}`));
  }

  if (income > 0 && budgetRatio < 0.55) {
    // Positive: good spending discipline
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.positive,
        priority: 0,
        title: "El mes viene con margen",
        body: `Los gastos van por debajo del 55% de los ingresos de ${MONTH_NAMES[month - 1]}.`,
        dedupeKey: `reminder-budget-good-${periodKey}`,
        periodKey,
        actionLabel: "Ver dashboard",
        actionLink: "/dashboard",
      }),
    );
  } else {
    upserts.push(resolveReminderIfPresent(userId, `reminder-budget-good-${periodKey}`));
  }

  // Upcoming recurring payments (P1)
  if (upcomingRecurringCount > 0) {
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: ActivityTone.neutral,
        priority: 1,
        title: "Hay pagos próximos",
        body: `${upcomingRecurringCount} pago${upcomingRecurringCount !== 1 ? "s" : ""} recurrente${upcomingRecurringCount !== 1 ? "s" : ""} vence${upcomingRecurringCount === 1 ? "" : "n"} en los próximos 7 días.`,
        dedupeKey: `reminder-recurring-${periodKey}`,
        periodKey,
        actionLabel: "Ver recurrentes",
        actionLink: "/recurring",
      }),
    );
  } else {
    upserts.push(resolveReminderIfPresent(userId, `reminder-recurring-${periodKey}`));
  }

  // Outstanding formal commitment reminder (P0 if overdue, P1 if active)
  if (debt > 0) {
    upserts.push(
      upsertActivity({
        userId,
        type: ActivityType.REMINDER,
        source: "monthly-reminders",
        tone: hasOverdueDebt ? ActivityTone.warning : ActivityTone.neutral,
        priority: hasOverdueDebt ? 2 : 1,
        title: hasOverdueDebt ? "Hay un crédito o cuota para revisar" : "Compromiso formal registrado",
        body: hasOverdueDebt
          ? formatARS(debt) + " en créditos y cuotas. Hay al menos un vencimiento para revisar."
          : formatARS(debt) + " en créditos y cuotas activos este mes.",
        dedupeKey: `reminder-debt-${periodKey}`,
        periodKey,
        actionLabel: "Ver créditos",
        actionLink: "/debts",
      }),
    );
  } else {
    upserts.push(resolveReminderIfPresent(userId, `reminder-debt-${periodKey}`));
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
      title: "Semana con ritmo más liviano",
      body: label + ". Puede ser una semana tranquila o el reflejo de pagos concentrados la semana anterior.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    EXPENSES_UP: {
      title: "El flujo reciente estuvo más activo",
      body: "Esta semana el movimiento fue mayor que la anterior. Puede incluir pagos fijos, tarjeta o compras puntuales.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    STABLE_WEEK: {
      title: "Semana con ritmo parejo",
      body: label + ". El flujo se mantuvo similar al de la semana anterior.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    WEEKEND_SPIKE: {
      title: "El fin de semana concentró más movimiento",
      body: label + ". Puede ser salidas, compras puntuales o pagos agrupados en el fin de semana.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    DELIVERY_HIGH: {
      title: "Una categoría tomó más peso esta semana",
      body: label + ". Te lo dejamos a mano para decidir si sigue alineado con tu mes.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    TRANSPORT_GROWTH: {
      title: "Transporte tuvo más actividad",
      body: label + ". Tenerlo en el radar puede ser útil si el patrón se repite.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    GOOD_SAVINGS: {
      title: "Semana con flujo liviano",
      body: "El balance de la semana fue positivo. No implica que el mes esté cerrado, pero es un buen ritmo.",
      actionLabel: "Ver objetivos",
      actionLink: "/goals",
    },
    LOW_SAVINGS: {
      title: "Semana de movimiento intenso",
      body: "Hubo varios pagos esta semana. Es normal al inicio del mes o cuando coinciden alquiler, tarjeta o servicios.",
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    },
    CATEGORY_DOMINANT: {
      title: "Una categoría concentró el gasto semanal",
      body: label + ". Puede ser un pago puntual grande. Conviene tenerlo visible.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
    CREDIT_HEAVY: {
      title: "Semana con uso alto de tarjeta",
      body: label + ". Te lo mostramos como contexto para el próximo cierre de tarjeta.",
      actionLabel: "Ver movimientos",
      actionLink: "/transactions",
    },
  };

  return bySignal[signalId] ?? defaults;
}
