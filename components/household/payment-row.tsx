"use client";

import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatDate, getPaymentRowClass, getPaymentIconClass } from "@/app/(private)/household/utils";
import type { Household, RecurringPayment, UserAccount, PayForm } from "@/app/(private)/household/types";

type PaymentRowProps = {
  payment: RecurringPayment;
  isExpanded: boolean;
  isPaying: boolean;
  payForm: PayForm;
  setPayForm: React.Dispatch<React.SetStateAction<PayForm>>;
  members: Household["members"];
  userAccounts: UserAccount[];
  hideAmounts: boolean;
  onPay: () => void;
  onConfirmPay: () => void;
  onCancel: () => void;
};

export function PaymentRow({
  payment,
  isExpanded,
  isPaying,
  payForm,
  setPayForm,
  members,
  userAccounts,
  hideAmounts,
  onPay,
  onConfirmPay,
  onCancel,
}: PaymentRowProps) {
  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${getPaymentRowClass(payment.status)}`}
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getPaymentIconClass(payment.status)}`}
        >
          {payment.status === "PAID" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : payment.status === "OVERDUE" ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{payment.name}</p>
          <p className="text-xs text-muted-foreground">
            {payment.status === "PAID"
              ? `Pagado${payment.occurrence?.paidAt ? ` · ${formatDate(payment.occurrence.paidAt)}` : ""}`
              : payment.status === "OVERDUE"
                ? `Venció el día ${payment.dueDay}`
                : `Vence el día ${payment.dueDay}`}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold text-foreground">
          {formatMoney(payment.occurrence?.finalAmount ?? payment.estimatedAmount, payment.currency, hideAmounts)}
        </p>
        {payment.status !== "PAID" ? (
          <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={onPay}>
            Pagar
          </Button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="mt-1 space-y-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.07] p-4">
          <p className="text-sm font-semibold text-foreground">Registrar pago — {payment.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pagó</Label>
              <select
                className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-foreground md:text-sm"
                value={payForm.paidByUserId || members[0]?.userProfileId}
                onChange={(e) => setPayForm((p) => ({ ...p, paidByUserId: e.target.value }))}
              >
                {members.map((member) => (
                  <option key={member.userProfileId} value={member.userProfileId}>
                    {member.userProfile.fullName ?? member.userProfile.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <select
                className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-foreground md:text-sm"
                value={payForm.accountId}
                onChange={(e) => setPayForm((p) => ({ ...p, accountId: e.target.value }))}
              >
                <option value="">Elegir cuenta…</option>
                {userAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.householdName ? ` — ${account.householdName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Monto final (opcional)</Label>
            <Input
              type="number"
              value={payForm.finalAmount}
              onChange={(e) => setPayForm((p) => ({ ...p, finalAmount: e.target.value }))}
              placeholder={String(payment.estimatedAmount)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isPaying || !payForm.accountId}
              onClick={onConfirmPay}
            >
              {isPaying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
