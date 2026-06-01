-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isHouseholdPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "userShareAmount" DECIMAL(18,2);
