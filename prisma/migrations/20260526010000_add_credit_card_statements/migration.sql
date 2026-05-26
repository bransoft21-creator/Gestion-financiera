-- Credit-card statements become the source of truth for card debt.
-- Existing Account/Debt/Transaction data stays intact for compatibility.

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CARD_PAYMENT';

CREATE TYPE "CardStatementStatus" AS ENUM (
  'OPEN',
  'CLOSED_PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'ARCHIVED'
);

CREATE TYPE "CardPaymentKind" AS ENUM (
  'MINIMUM',
  'FULL',
  'PARTIAL',
  'CUSTOM'
);

CREATE TABLE "CreditCard" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "accountId" TEXT,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "network" TEXT,
  "last4" TEXT,
  "closeDay" INTEGER,
  "dueDay" INTEGER,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'ARS',
  "creditLimit" DECIMAL(18,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardStatement" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "creditCardId" TEXT NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "cycleStartDate" TIMESTAMP(3) NOT NULL,
  "cycleEndDate" TIMESTAMP(3) NOT NULL,
  "closeDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "status" "CardStatementStatus" NOT NULL DEFAULT 'OPEN',
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "pendingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "minimumPayment" DECIMAL(18,2),
  "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CardStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatementTransaction" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "creditCardId" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "transactionId" TEXT,
  "categoryId" TEXT,
  "description" TEXT,
  "currency" "CurrencyCode" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "installmentGroupId" TEXT,
  "installmentNumber" INTEGER,
  "totalInstallments" INTEGER,
  "isTax" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "StatementTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardPayment" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "creditCardId" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "transactionId" TEXT,
  "kind" "CardPaymentKind" NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditCard_accountId_key" ON "CreditCard"("accountId");
CREATE INDEX "CreditCard_householdId_isActive_idx" ON "CreditCard"("householdId", "isActive");
CREATE INDEX "CreditCard_createdById_idx" ON "CreditCard"("createdById");
CREATE INDEX "CreditCard_accountId_idx" ON "CreditCard"("accountId");

CREATE UNIQUE INDEX "CardStatement_creditCardId_periodYear_periodMonth_key"
  ON "CardStatement"("creditCardId", "periodYear", "periodMonth");
CREATE INDEX "CardStatement_householdId_status_dueDate_idx" ON "CardStatement"("householdId", "status", "dueDate");
CREATE INDEX "CardStatement_creditCardId_status_idx" ON "CardStatement"("creditCardId", "status");

CREATE INDEX "StatementTransaction_householdId_occurredAt_idx" ON "StatementTransaction"("householdId", "occurredAt");
CREATE INDEX "StatementTransaction_creditCardId_occurredAt_idx" ON "StatementTransaction"("creditCardId", "occurredAt");
CREATE INDEX "StatementTransaction_statementId_idx" ON "StatementTransaction"("statementId");
CREATE INDEX "StatementTransaction_transactionId_idx" ON "StatementTransaction"("transactionId");
CREATE UNIQUE INDEX "StatementTransaction_transactionId_key" ON "StatementTransaction"("transactionId");
CREATE INDEX "StatementTransaction_installmentGroupId_idx" ON "StatementTransaction"("installmentGroupId");

CREATE INDEX "CardPayment_householdId_paidAt_idx" ON "CardPayment"("householdId", "paidAt");
CREATE INDEX "CardPayment_creditCardId_paidAt_idx" ON "CardPayment"("creditCardId", "paidAt");
CREATE INDEX "CardPayment_statementId_paidAt_idx" ON "CardPayment"("statementId", "paidAt");
CREATE INDEX "CardPayment_sourceAccountId_idx" ON "CardPayment"("sourceAccountId");
CREATE INDEX "CardPayment_transactionId_idx" ON "CardPayment"("transactionId");

ALTER TABLE "CreditCard"
  ADD CONSTRAINT "CreditCard_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditCard"
  ADD CONSTRAINT "CreditCard_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditCard"
  ADD CONSTRAINT "CreditCard_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CardStatement"
  ADD CONSTRAINT "CardStatement_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardStatement"
  ADD CONSTRAINT "CardStatement_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementTransaction"
  ADD CONSTRAINT "StatementTransaction_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementTransaction"
  ADD CONSTRAINT "StatementTransaction_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementTransaction"
  ADD CONSTRAINT "StatementTransaction_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "CardStatement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementTransaction"
  ADD CONSTRAINT "StatementTransaction_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CardPayment"
  ADD CONSTRAINT "CardPayment_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardPayment"
  ADD CONSTRAINT "CardPayment_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardPayment"
  ADD CONSTRAINT "CardPayment_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "CardStatement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardPayment"
  ADD CONSTRAINT "CardPayment_sourceAccountId_fkey"
  FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardPayment"
  ADD CONSTRAINT "CardPayment_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
