ALTER TABLE "ActivityItem"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "ActivityItem_userId_resolvedAt_idx" ON "ActivityItem"("userId", "resolvedAt");
