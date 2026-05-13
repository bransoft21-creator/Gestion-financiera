CREATE TYPE "RecurringPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

CREATE TABLE "HouseholdRecurringPayment" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "categoryId" TEXT,
  "name" TEXT NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'ARS',
  "estimatedAmount" DECIMAL(18,2) NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "splitMode" "SharedSplitMode" NOT NULL DEFAULT 'EQUAL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HouseholdRecurringPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdRecurringPaymentParticipant" (
  "recurringPaymentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "percentage" DECIMAL(5,2),
  "fixedAmount" DECIMAL(18,2),
  CONSTRAINT "HouseholdRecurringPaymentParticipant_pkey" PRIMARY KEY ("recurringPaymentId","userId")
);

CREATE TABLE "HouseholdRecurringPaymentOccurrence" (
  "id" TEXT NOT NULL,
  "recurringPaymentId" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paidByUserId" TEXT,
  "sharedTransactionId" TEXT,
  "finalAmount" DECIMAL(18,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdRecurringPaymentOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HouseholdRecurringPayment_householdId_isActive_idx" ON "HouseholdRecurringPayment"("householdId", "isActive");
CREATE INDEX "HouseholdRecurringPayment_createdById_idx" ON "HouseholdRecurringPayment"("createdById");
CREATE INDEX "HouseholdRecurringPayment_categoryId_idx" ON "HouseholdRecurringPayment"("categoryId");
CREATE INDEX "HouseholdRecurringPaymentParticipant_userId_idx" ON "HouseholdRecurringPaymentParticipant"("userId");
CREATE UNIQUE INDEX "HouseholdRecurringPaymentOccurrence_recurringPaymentId_monthKey_key" ON "HouseholdRecurringPaymentOccurrence"("recurringPaymentId","monthKey");
CREATE INDEX "HouseholdRecurringPaymentOccurrence_recurringPaymentId_status_idx" ON "HouseholdRecurringPaymentOccurrence"("recurringPaymentId","status");

ALTER TABLE "HouseholdRecurringPayment" ADD CONSTRAINT "HouseholdRecurringPayment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPayment" ADD CONSTRAINT "HouseholdRecurringPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPayment" ADD CONSTRAINT "HouseholdRecurringPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD CONSTRAINT "HouseholdRecurringPaymentParticipant_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "HouseholdRecurringPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD CONSTRAINT "HouseholdRecurringPaymentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPaymentOccurrence" ADD CONSTRAINT "HouseholdRecurringPaymentOccurrence_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "HouseholdRecurringPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdRecurringPaymentOccurrence" ADD CONSTRAINT "HouseholdRecurringPaymentOccurrence_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
