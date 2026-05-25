-- Acuerdos financieros personales (Pendientes)
-- Modela dinero en tránsito entre personas: préstamos, deudas informales, gastos compartidos.
-- Separado del ledger principal para no contaminar el disponible real.

-- Nuevos valores en TransactionType para movimientos de caja vinculados a acuerdos
ALTER TYPE "TransactionType" ADD VALUE 'PERSONAL_LOAN_GIVEN';
ALTER TYPE "TransactionType" ADD VALUE 'PERSONAL_LOAN_RETURN';

-- Enums del módulo
CREATE TYPE "AgreementDirection" AS ENUM ('LENT', 'BORROWED', 'SHARED');
CREATE TYPE "AgreementCategory" AS ENUM ('PERSONAL', 'FAMILY', 'WORK', 'SOCIAL', 'OTHER');
CREATE TYPE "AgreementStatus" AS ENUM ('OPEN', 'PARTIAL', 'OVERDUE', 'CLOSED', 'FORGIVEN', 'CANCELED');
CREATE TYPE "AgreementInterestType" AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "AgreementEventType" AS ENUM (
  'PAYMENT_RECEIVED',
  'PAYMENT_SENT',
  'INTEREST_APPLIED',
  'DATE_EXTENDED',
  'REFINANCED',
  'PARTIAL_FORGIVEN',
  'NOTE_ADDED',
  'CLOSED',
  'CANCELED'
);

-- Contactos personales (no son usuarios de Meridian)
CREATE TABLE "PersonContact" (
  "id"                    TEXT NOT NULL,
  "householdId"           TEXT NOT NULL,
  "createdById"           TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "alias"                 TEXT,
  "phone"                 TEXT,
  "email"                 TEXT,
  "notes"                 TEXT,
  "avatarColor"           TEXT,
  "totalLentToThem"       DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalBorrowedFromThem" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "avgReturnDays"         INTEGER,
  "agreementCount"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "deletedAt"             TIMESTAMP(3),

  CONSTRAINT "PersonContact_pkey" PRIMARY KEY ("id")
);

-- Acuerdos financieros: el contrato informal entre dos personas sobre dinero
CREATE TABLE "PersonalAgreement" (
  "id"                   TEXT NOT NULL,
  "householdId"          TEXT NOT NULL,
  "createdById"          TEXT NOT NULL,
  "contactId"            TEXT NOT NULL,
  "direction"            "AgreementDirection" NOT NULL,
  "status"               "AgreementStatus" NOT NULL DEFAULT 'OPEN',
  "currency"             "CurrencyCode" NOT NULL DEFAULT 'ARS',
  "originalAmount"       DECIMAL(18,2) NOT NULL,
  "currentBalance"       DECIMAL(18,2) NOT NULL,
  "description"          TEXT,
  "category"             "AgreementCategory" NOT NULL DEFAULT 'PERSONAL',
  "agreedReturnDate"     TIMESTAMP(3),
  "occurredAt"           TIMESTAMP(3) NOT NULL,
  "hasInterest"          BOOLEAN NOT NULL DEFAULT false,
  "interestType"         "AgreementInterestType",
  "interestAmount"       DECIMAL(18,2),
  "interestRate"         DECIMAL(7,4),
  "expectedInstallments" INTEGER,
  "sourceAccountId"      TEXT,
  "closedAt"             TIMESTAMP(3),
  "notes"                TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  "deletedAt"            TIMESTAMP(3),

  CONSTRAINT "PersonalAgreement_pkey" PRIMARY KEY ("id")
);

-- Eventos del ciclo de vida de un acuerdo: pagos, extensiones, refinanciaciones
CREATE TABLE "AgreementEvent" (
  "id"            TEXT NOT NULL,
  "agreementId"   TEXT NOT NULL,
  "createdById"   TEXT NOT NULL,
  "type"          "AgreementEventType" NOT NULL,
  "amount"        DECIMAL(18,2),
  "currency"      "CurrencyCode",
  "description"   TEXT,
  "transactionId" TEXT,
  "occurredAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgreementEvent_pkey" PRIMARY KEY ("id")
);

-- Índices PersonContact
CREATE INDEX "PersonContact_householdId_idx"  ON "PersonContact"("householdId");
CREATE INDEX "PersonContact_createdById_idx"  ON "PersonContact"("createdById");

-- Índices PersonalAgreement
CREATE INDEX "PersonalAgreement_householdId_status_idx"    ON "PersonalAgreement"("householdId", "status");
CREATE INDEX "PersonalAgreement_householdId_contactId_idx" ON "PersonalAgreement"("householdId", "contactId");
CREATE INDEX "PersonalAgreement_createdById_idx"           ON "PersonalAgreement"("createdById");
CREATE INDEX "PersonalAgreement_contactId_idx"             ON "PersonalAgreement"("contactId");
CREATE INDEX "PersonalAgreement_agreedReturnDate_idx"      ON "PersonalAgreement"("agreedReturnDate");

-- Índices AgreementEvent
CREATE INDEX "AgreementEvent_agreementId_occurredAt_idx" ON "AgreementEvent"("agreementId", "occurredAt");
CREATE INDEX "AgreementEvent_createdById_idx"            ON "AgreementEvent"("createdById");
CREATE INDEX "AgreementEvent_transactionId_idx"          ON "AgreementEvent"("transactionId");

-- Foreign keys PersonContact
ALTER TABLE "PersonContact"
  ADD CONSTRAINT "PersonContact_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PersonContact"
  ADD CONSTRAINT "PersonContact_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys PersonalAgreement
ALTER TABLE "PersonalAgreement"
  ADD CONSTRAINT "PersonalAgreement_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PersonalAgreement"
  ADD CONSTRAINT "PersonalAgreement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PersonalAgreement"
  ADD CONSTRAINT "PersonalAgreement_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "PersonContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PersonalAgreement"
  ADD CONSTRAINT "PersonalAgreement_sourceAccountId_fkey"
  FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys AgreementEvent
ALTER TABLE "AgreementEvent"
  ADD CONSTRAINT "AgreementEvent_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "PersonalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgreementEvent"
  ADD CONSTRAINT "AgreementEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgreementEvent"
  ADD CONSTRAINT "AgreementEvent_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
