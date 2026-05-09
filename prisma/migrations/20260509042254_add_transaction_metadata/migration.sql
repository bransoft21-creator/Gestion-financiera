-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE', 'EXTRAORDINARY');

-- CreateEnum
CREATE TYPE "TransactionOrigin" AS ENUM ('MANUAL', 'CARD_SUMMARY', 'BANK', 'MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT', 'CREDIT', 'TRANSFER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "expenseType" "ExpenseType",
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "isInstallment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" "TransactionOrigin" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "totalInstallments" INTEGER;
