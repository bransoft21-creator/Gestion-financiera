CREATE TABLE "AiFinancialAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFinancialAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiFinancialAnalysis_userId_month_key" ON "AiFinancialAnalysis"("userId", "month");
CREATE INDEX "AiFinancialAnalysis_userId_idx" ON "AiFinancialAnalysis"("userId");

ALTER TABLE "AiFinancialAnalysis"
ADD CONSTRAINT "AiFinancialAnalysis_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
