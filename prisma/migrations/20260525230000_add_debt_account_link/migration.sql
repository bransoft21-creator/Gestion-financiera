-- Vincula una Debt de tipo CREDIT_CARD a su cuenta asociada.
-- Cuando existe este vínculo, los EXPENSE en esa cuenta incrementan
-- automáticamente el outstandingAmount de la deuda.

ALTER TABLE "Debt" ADD COLUMN "accountId" TEXT;

CREATE INDEX "Debt_accountId_idx" ON "Debt"("accountId");

ALTER TABLE "Debt"
    ADD CONSTRAINT "Debt_accountId_fkey"
    FOREIGN KEY ("accountId")
    REFERENCES "Account"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
