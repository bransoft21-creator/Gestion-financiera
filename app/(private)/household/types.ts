export type ExternalParticipant = {
  id: string;
  name: string;
  email: string | null;
};

export type Household = {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string | Date;
  members: Array<{
    id: string;
    role: string;
    status: string;
    userProfileId: string;
    userProfile: {
      fullName: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  invites: Array<{
    id: string;
    email: string;
    expiresAt: string | Date;
    status: string;
  }>;
  externalParticipants: ExternalParticipant[];
};

export type HouseholdBalance = {
  summary: string;
  lastSettledAt: string | null;
  settlement: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    amount: number;
  } | null;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    balance: number;
    isExternal?: boolean;
  }>;
  recentSharedTransactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    currency: "ARS" | "USD";
    occurredAt: string;
    paidByName: string;
    participantCount: number;
  }>;
};

export type HouseholdSettlement = {
  id: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  settledBy: {
    fullName: string | null;
    email: string;
  };
};

export type HouseholdBriefingStatus = "STABLE" | "NEEDS_BALANCE" | "LOW_ACTIVITY" | "HIGH_SPEND";

export type HouseholdBriefing = {
  status: HouseholdBriefingStatus;
  tone: "emerald" | "amber" | "blue" | "zinc";
  title: string;
  summary: string;
  metrics: {
    totalSharedAmount: number;
    transactionCount: number;
    pendingAmount: number;
    currency: "ARS" | "USD";
    topPayer: { userId: string; name: string; amount: number } | null;
  };
  topCategories: Array<{ id: string; name: string; color: string | null; amount: number; count: number }>;
  settlement: HouseholdBalance["settlement"];
  memberBalances: HouseholdBalance["members"];
  ctas: Array<{ label: string; href: string; intent: "primary" | "secondary" }>;
};

export type RecurringPayment = {
  id: string;
  name: string;
  estimatedAmount: number;
  currency: "ARS" | "USD";
  dueDay: number;
  splitMode: "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT";
  category: { id: string; name: string; color: string | null } | null;
  participants: Array<{ userId: string | null; externalParticipantId?: string | null; percentage: number | null; fixedAmount: number | null }>;
  status: "PENDING" | "PAID" | "OVERDUE";
  occurrence: {
    id: string;
    paidAt: string | null;
    paidByUserId: string | null;
    finalAmount: number | null;
    sharedTransactionId: string | null;
  } | null;
};

export type RecurringPaymentsSummary = {
  payments: RecurringPayment[];
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalCount: number;
  summary: string;
};

export type UserAccount = {
  id: string;
  householdId: string;
  householdName: string | undefined;
  name: string;
  type: string;
  currency: "ARS" | "USD";
  currentBalance: number;
};

export type HouseholdTab = "overview" | "payments" | "team";

export type PayForm = {
  paidByUserId: string;
  accountId: string;
  finalAmount: string;
};
