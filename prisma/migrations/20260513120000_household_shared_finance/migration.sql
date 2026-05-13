CREATE TYPE "HouseholdKind" AS ENUM ('PERSONAL', 'HOUSEHOLD');
CREATE TYPE "HouseholdInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "SharedSplitMode" AS ENUM ('EQUAL');
CREATE TYPE "SharedParticipantStatus" AS ENUM ('OPEN', 'SETTLED');

ALTER TABLE "Household"
ADD COLUMN "avatar" TEXT,
ADD COLUMN "kind" "HouseholdKind" NOT NULL DEFAULT 'PERSONAL';

ALTER TABLE "Transaction" ADD COLUMN "clientRequestId" TEXT;

CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "HouseholdInviteStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedTransaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paidByUserId" TEXT NOT NULL,
    "splitMode" "SharedSplitMode" NOT NULL DEFAULT 'EQUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedTransactionParticipant" (
    "id" TEXT NOT NULL,
    "sharedTransactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "SharedParticipantStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "SharedTransactionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");
CREATE INDEX "HouseholdInvite_householdId_status_idx" ON "HouseholdInvite"("householdId", "status");
CREATE INDEX "HouseholdInvite_email_idx" ON "HouseholdInvite"("email");
CREATE INDEX "HouseholdInvite_expiresAt_idx" ON "HouseholdInvite"("expiresAt");

CREATE UNIQUE INDEX "SharedTransaction_transactionId_key" ON "SharedTransaction"("transactionId");
CREATE INDEX "SharedTransaction_householdId_createdAt_idx" ON "SharedTransaction"("householdId", "createdAt");
CREATE INDEX "SharedTransaction_paidByUserId_idx" ON "SharedTransaction"("paidByUserId");

CREATE UNIQUE INDEX "SharedTransactionParticipant_sharedTransactionId_userId_key" ON "SharedTransactionParticipant"("sharedTransactionId", "userId");
CREATE INDEX "SharedTransactionParticipant_userId_status_idx" ON "SharedTransactionParticipant"("userId", "status");
CREATE UNIQUE INDEX "Transaction_clientRequestId_key" ON "Transaction"("clientRequestId");

ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedTransaction" ADD CONSTRAINT "SharedTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedTransaction" ADD CONSTRAINT "SharedTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedTransaction" ADD CONSTRAINT "SharedTransaction_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedTransactionParticipant" ADD CONSTRAINT "SharedTransactionParticipant_sharedTransactionId_fkey" FOREIGN KEY ("sharedTransactionId") REFERENCES "SharedTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedTransactionParticipant" ADD CONSTRAINT "SharedTransactionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
