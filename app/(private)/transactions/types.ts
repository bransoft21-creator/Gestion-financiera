export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "DEBT_PAYMENT"
  | "GOAL_CONTRIBUTION"
  | "INVESTMENT";

export type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT" | "GOAL" | "INVESTMENT" | "ADJUSTMENT";
export type CurrencyCode = "ARS" | "USD";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "CANCELED";
export type ExpenseType = "FIXED" | "VARIABLE" | "EXTRAORDINARY";
export type TransactionOrigin = "MANUAL" | "CARD_SUMMARY" | "BANK" | "MERCADO_PAGO";
export type PaymentMethod = "CASH" | "DEBIT" | "CREDIT" | "TRANSFER";
export type SplitMode = "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT";

export type AccountOption = {
  id: string;
  name: string;
  type: string;
  currency: CurrencyCode;
  currentBalance: string;
};

export type CategoryOption = {
  id: string;
  name: string;
  type: CategoryType;
};

export type TransactionItem = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: CurrencyCode;
  amount: string;
  description: string | null;
  notes: string | null;
  expenseType: ExpenseType | null;
  origin: TransactionOrigin;
  paymentMethod: PaymentMethod | null;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  isRecurring: boolean;
  occurredAt: string;
  account: {
    id: string;
    name: string;
  };
  transferAccount: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
  } | null;
  sharedTransaction: {
    id: string;
    householdId: string;
    household: {
      id: string;
      name: string;
      avatar: string | null;
    };
  } | null;
};

export type SharedHouseholdOption = {
  id: string;
  name: string;
  avatar: string | null;
  members: Array<{
    userProfileId: string;
    userProfile: {
      fullName: string | null;
      email: string;
    };
  }>;
};

export type TransactionsClientProps = {
  householdId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  sharedHouseholds: SharedHouseholdOption[];
  defaultCurrency?: CurrencyCode;
};

export type Filters = {
  type: string;
  categoryId: string;
  from: string;
  to: string;
};

export type FeedSummary = {
  income: number;
  expenses: number;
  count: number;
};
