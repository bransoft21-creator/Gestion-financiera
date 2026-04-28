"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardSummary = {
  metrics: {
    income: number;
    expenses: number;
    remainingReservedBudget: number;
    upcomingObligations: number;
    realAvailable: number;
    totalOutstandingDebt: number;
  };
  alerts: string[];
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: "danger" | "warning" | "info" | "success";
};

type NotificationsButtonProps = {
  compact?: boolean;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function NotificationsButton({ compact = false }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const notifiedIds = useRef(new Set<string>());

  const notifications = useMemo(() => buildNotifications(summary), [summary]);
  const importantCount = notifications.filter((item) => item.tone !== "success").length;

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const params = new URLSearchParams({
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
      });
      const response = await fetch(`/api/dashboard/summary?${params.toString()}`);
      const payload = (await response.json()) as { data?: DashboardSummary };
      if (response.ok) setSummary(payload.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPermission("Notification" in window ? Notification.permission : "unsupported");
      void loadSummary();
    }, 0);
    const intervalId = window.setInterval(() => void loadSummary(), 60_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (permission !== "granted") return;

    notifications
      .filter((item) => item.tone === "danger" || item.tone === "warning")
      .forEach((item) => {
        if (notifiedIds.current.has(item.id)) return;
        notifiedIds.current.add(item.id);
        new Notification(item.title, {
          body: item.body,
          tag: item.id,
        });
      });
  }, [notifications, permission]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        {importantCount > 0 ? (
          <BellRing className="h-4 w-4 text-amber-400" aria-hidden="true" />
        ) : (
          <Bell className="h-4 w-4" aria-hidden="true" />
        )}
        {compact ? null : "Notificaciones"}
        {importantCount > 0 ? (
          <span className="ml-[-4px] rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
            {importantCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/35">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Centro financiero</p>
              <p className="text-xs text-muted-foreground">Alertas del mes actual</p>
            </div>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
            {notifications.map((item) => {
              const Icon = item.tone === "success" ? CheckCircle2 : AlertTriangle;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border p-3",
                    item.tone === "danger" && "border-rose-500/25 bg-rose-500/10",
                    item.tone === "warning" && "border-amber-500/25 bg-amber-500/10",
                    item.tone === "info" && "border-sky-500/25 bg-sky-500/10",
                    item.tone === "success" && "border-emerald-500/25 bg-emerald-500/10",
                  )}
                >
                  <div className="flex gap-2">
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        item.tone === "danger" && "text-rose-400",
                        item.tone === "warning" && "text-amber-400",
                        item.tone === "info" && "text-sky-400",
                        item.tone === "success" && "text-emerald-400",
                      )}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3">
            {permission === "unsupported" ? (
              <p className="text-xs text-muted-foreground">
                Tu navegador no soporta notificaciones del sistema.
              </p>
            ) : permission === "granted" ? (
              <p className="text-xs text-emerald-400">Notificaciones del navegador activas.</p>
            ) : (
              <Button className="w-full" size="sm" onClick={enableNotifications}>
                <BellRing className="h-4 w-4" aria-hidden="true" />
                Activar notificaciones
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildNotifications(summary: DashboardSummary | null): NotificationItem[] {
  if (!summary) {
    return [
      {
        id: "loading",
        title: "Sin datos todavía",
        body: "Cuando cargue el dashboard vas a ver alertas de presupuesto, obligaciones y disponible.",
        tone: "info",
      },
    ];
  }

  const { metrics, alerts } = summary;
  const items: NotificationItem[] = [];

  if (metrics.realAvailable < 0) {
    items.push({
      id: "real-available-negative",
      title: "Disponible real en negativo",
      body: `Te faltan ${formatMoney(Math.abs(metrics.realAvailable))} luego de reservas y obligaciones.`,
      tone: "danger",
    });
  }

  if (metrics.income > 0 && metrics.expenses / metrics.income >= 0.8) {
    items.push({
      id: "expenses-near-income",
      title: "Gastos cerca del límite",
      body: `Ya usaste ${Math.round((metrics.expenses / metrics.income) * 100)}% de tus ingresos del mes.`,
      tone: metrics.expenses > metrics.income ? "danger" : "warning",
    });
  }

  if (metrics.remainingReservedBudget > 0) {
    items.push({
      id: "budget-reserved",
      title: "Presupuesto reservado",
      body: `Quedan ${formatMoney(metrics.remainingReservedBudget)} reservados para categorías pendientes.`,
      tone: "info",
    });
  }

  if (metrics.upcomingObligations > 0) {
    items.push({
      id: "upcoming-obligations",
      title: "Obligaciones próximas",
      body: `Este mes tenés ${formatMoney(metrics.upcomingObligations)} entre recurrentes, metas y deuda.`,
      tone: "warning",
    });
  }

  alerts.forEach((alert, index) => {
    const id = `dashboard-alert-${index}-${alert}`;
    if (items.some((item) => item.body === alert || item.title === alert)) return;
    items.push({
      id,
      title: "Alerta del dashboard",
      body: alert,
      tone: "warning",
    });
  });

  if (items.length === 0) {
    items.push({
      id: "all-good",
      title: "Todo bajo control",
      body: "No hay alertas financieras importantes para este mes.",
      tone: "success",
    });
  }

  return items.slice(0, 6);
}
