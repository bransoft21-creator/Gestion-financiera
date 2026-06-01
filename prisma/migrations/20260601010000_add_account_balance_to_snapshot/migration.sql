-- Add accountBalanceAmount to MonthlySnapshot.
-- Stores the sum of Account.currentBalance at capture time (primary currency, active accounts).
-- This captures the real money available including carry-over from prior months,
-- which the P&L-based availableAmount cannot reconstruct after the fact.
ALTER TABLE "MonthlySnapshot"
ADD COLUMN "accountBalanceAmount" DECIMAL(18, 2);
