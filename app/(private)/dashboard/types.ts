import type { ExpenseCategoryChartItem } from "@/components/dashboard/expense-category-chart";
import type { NavigationAwareness } from "@/lib/navigation-awareness";

export type { ExpenseCategoryChartItem };

export type ActivationAction = {
  id:
    | "create-account"
    | "first-income"
    | "smart-import"
    | "setup-household"
    | "shared-expense"
    | "invite-household"
    | "setup-budgets"
    | "organize-debts"
    | "review-movements"
    | "setup-recurring";
  title: string;
  description: string;
  href: string;
  reason: string;
};

export type NextStepRecommendation = {
  shouldShow: boolean;
  headline: string;
  body: string;
  actions: ActivationAction[];
  primaryAction: ActivationAction | null;
  isOnboardingFresh: boolean;
};

export type DashboardSummary = {
  metrics: {
    currency: "ARS" | "USD" | string;
    currencyScope: {
      primaryCurrency: "ARS" | "USD" | string;
      totalsByCurrency: Array<{
        currency: "ARS" | "USD" | string;
        amount: number;
        count: number;
      }>;
      ignoredCurrencies: Array<"ARS" | "USD" | string>;
      mixedCurrencies: boolean;
    };
    income: number;
    expenses: number;
    balance: number;
    estimatedSavings: number;
    totalBudgeted: number;
    budgetedSpent: number;
    remainingReservedBudget: number;
    upcomingRecurringExpenses: number;
    requiredGoalContributions: number;
    upcomingDebtPayments: number;
    upcomingObligations: number;
    realAvailable: number;
    savingsRate: number;
    spendingRate: number;
    totalOutstandingDebt: number;
    accountBalances: Array<{
      currency: "ARS" | "USD" | string;
      amount: number;
      accountCount: number;
    }>;
    expensesByType: {
      fixed: number;
      variable: number;
      extraordinary: number;
      unclassified: number;
    };
    fixedToIncomeRatio: number;
    projection: {
      isCurrentMonth: boolean;
      daysInMonth: number;
      dayOfMonth: number;
      daysRemaining: number;
      projectedExpenses: number;
      projectedBalance: number;
      projectedRealAvailable: number;
      confidence: "high" | "medium" | "low";
      confidenceNote: string;
      hasEarlyLargeFixed: boolean;
    };
  };
  expensesByCategory: ExpenseCategoryChartItem[];
  expenseCategoryDetails: Array<{
    id: string;
    name: string;
    total: number;
    items: Array<{
      id: string;
      description: string | null;
      amount: number;
      currency: "ARS" | "USD" | string;
      occurredAt: string;
      account: { id: string; name: string };
    }>;
  }>;
  latestTransactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | string;
    currency: "ARS" | "USD";
    amount: number;
    description: string | null;
    occurredAt: string;
    account: { name: string };
    category: { name: string } | null;
  }>;
  alerts: string[];
  insights: Array<{
    title: string;
    message: string;
    tone: "positive" | "warning" | "danger" | "default";
    actionLabel: string;
    href: string;
  }>;
  activation: NextStepRecommendation;
  awareness: NavigationAwareness;
};

export type ActivityPreviewItem = {
  id: string;
  type: "SIGNAL" | "INSIGHT" | "SYSTEM" | "REMINDER";
  tone: "positive" | "neutral" | "warning";
  priority: number;
  title: string;
  body: string;
  actionLabel: string | null;
  actionLink: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type InsightCardTone = "positive" | "warning" | "danger" | "neutral" | "info";
export type InsightSignalTone = "positive" | "warning" | "neutral";
export type HealthSignal = { label: string; tone: "positive" | "warning" };
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type TimeContext = {
  greeting: string;
  timeOfDay: TimeOfDay;
  isWeekend: boolean;
};
