-- Drop Budget.reservedAmount — campo nunca actualizado correctamente.
-- La reserva de presupuesto siempre se computa dinámicamente como
-- max(plannedAmount - spentAmount, 0) en financial-ledger.computeBudgetReservation.
-- El valor almacenado en DB nunca fue leído por ningún servicio; era siempre 0.
ALTER TABLE "Budget" DROP COLUMN "reservedAmount";
