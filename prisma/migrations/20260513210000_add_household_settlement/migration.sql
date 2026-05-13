-- CreateTable
CREATE TABLE "HouseholdSettlement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "settledByUserId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdSettlement_householdId_createdAt_idx" ON "HouseholdSettlement"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "HouseholdSettlement_settledByUserId_idx" ON "HouseholdSettlement"("settledByUserId");

-- AddForeignKey
ALTER TABLE "HouseholdSettlement" ADD CONSTRAINT "HouseholdSettlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdSettlement" ADD CONSTRAINT "HouseholdSettlement_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
