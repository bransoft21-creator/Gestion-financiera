-- Launch Safety: persistent AI usage accounting and Smart Import dedupe cache.

CREATE TABLE "AiUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartImportCache" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SmartImportCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_userId_endpoint_createdAt_idx" ON "AiUsage"("userId", "endpoint", "createdAt");
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

CREATE UNIQUE INDEX "SmartImportCache_householdId_fileHash_key" ON "SmartImportCache"("householdId", "fileHash");
CREATE INDEX "SmartImportCache_householdId_createdAt_idx" ON "SmartImportCache"("householdId", "createdAt");

ALTER TABLE "AiUsage"
ADD CONSTRAINT "AiUsage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmartImportCache"
ADD CONSTRAINT "SmartImportCache_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
