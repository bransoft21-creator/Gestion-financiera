-- CreateTable HouseholdExternalParticipant
CREATE TABLE "HouseholdExternalParticipant" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "HouseholdExternalParticipant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HouseholdExternalParticipant_householdId_idx" ON "HouseholdExternalParticipant"("householdId");
ALTER TABLE "HouseholdExternalParticipant" ADD CONSTRAINT "HouseholdExternalParticipant_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable SharedTransactionParticipant
ALTER TABLE "SharedTransactionParticipant" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "SharedTransactionParticipant" ADD COLUMN "externalParticipantId" TEXT;
CREATE INDEX "SharedTransactionParticipant_externalParticipantId_idx" ON "SharedTransactionParticipant"("externalParticipantId");
ALTER TABLE "SharedTransactionParticipant" ADD CONSTRAINT "SharedTransactionParticipant_externalParticipantId_fkey" FOREIGN KEY ("externalParticipantId") REFERENCES "HouseholdExternalParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable HouseholdRecurringPaymentParticipant
ALTER TABLE "HouseholdRecurringPaymentParticipant" DROP CONSTRAINT "HouseholdRecurringPaymentParticipant_pkey";
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "HouseholdRecurringPaymentParticipant" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD COLUMN "externalParticipantId" TEXT;
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD CONSTRAINT "HouseholdRecurringPaymentParticipant_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "HouseholdRecurringPaymentParticipant_recurringPaymentId_userId_key" ON "HouseholdRecurringPaymentParticipant"("recurringPaymentId", "userId");
CREATE UNIQUE INDEX "HouseholdRecurringPaymentParticipant_recurringPaymentId_externalParticipantId_key" ON "HouseholdRecurringPaymentParticipant"("recurringPaymentId", "externalParticipantId");
CREATE INDEX "HouseholdRecurringPaymentParticipant_externalParticipantId_idx" ON "HouseholdRecurringPaymentParticipant"("externalParticipantId");
ALTER TABLE "HouseholdRecurringPaymentParticipant" ADD CONSTRAINT "HouseholdRecurringPaymentParticipant_externalParticipantId_fkey" FOREIGN KEY ("externalParticipantId") REFERENCES "HouseholdExternalParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
