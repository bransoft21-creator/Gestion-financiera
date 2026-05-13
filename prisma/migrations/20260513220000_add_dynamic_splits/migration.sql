-- AlterEnum
ALTER TYPE "SharedSplitMode" ADD VALUE 'PERCENTAGE';
ALTER TYPE "SharedSplitMode" ADD VALUE 'CUSTOM_AMOUNT';

-- AlterTable
ALTER TABLE "SharedTransactionParticipant" ADD COLUMN "percentage" DECIMAL(5,2);
