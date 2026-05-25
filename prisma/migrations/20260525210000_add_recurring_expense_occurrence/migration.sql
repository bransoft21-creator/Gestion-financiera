-- Historial de ocurrencias para recurrentes personales.
-- Adopta el mismo patrón de RecurringExpenseOccurrence del módulo del hogar:
-- una fila por (recurringExpenseId, monthKey) con status PENDING | PAID | OVERDUE.
-- La tabla empieza vacía — datos históricos no existen.
-- Cuando el usuario paga un recurrente vía /api/recurring-expenses/:id/pay,
-- se crea la ocurrencia y se avanza nextDueDate automáticamente (fin del doble descuento).

CREATE TABLE "RecurringExpenseOccurrence" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "finalAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpenseOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringExpenseOccurrence_recurringExpenseId_monthKey_key"
    ON "RecurringExpenseOccurrence"("recurringExpenseId", "monthKey");

CREATE INDEX "RecurringExpenseOccurrence_recurringExpenseId_status_idx"
    ON "RecurringExpenseOccurrence"("recurringExpenseId", "status");

ALTER TABLE "RecurringExpenseOccurrence"
    ADD CONSTRAINT "RecurringExpenseOccurrence_recurringExpenseId_fkey"
    FOREIGN KEY ("recurringExpenseId")
    REFERENCES "RecurringExpense"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
