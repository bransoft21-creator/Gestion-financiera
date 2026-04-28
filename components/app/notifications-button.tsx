"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings2,
  Volume2,
} from "lucide-react";
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

type NotificationRule =
  | "realAvailable"
  | "expenseLimit"
  | "obligations"
  | "budgetReserve"
  | "debt";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: "danger" | "warning" | "info" | "success";
  rule: NotificationRule | "system";
};

type NotificationPreferences = {
  browserPush: boolean;
  expenseLimitPercent: number;
  rules: Record<NotificationRule, boolean>;
};

type NotificationsButtonProps = {
  compact?: boolean;
  className?: string;
};

const READ_STORAGE_KEY = "finance-control-read-notifications";
const PUSHED_STORAGE_KEY = "finance-control-pushed-notifications";
const PREFS_STORAGE_KEY = "finance-control-notification-preferences";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  browserPush: false,
  expenseLimitPercent: 80,
  rules: {
    realAvailable: true,
    expenseLimit: true,
    obligations: true,
    budgetReserve: true,
    debt: false,
  },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function NotificationsButton({ compact = false, className }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"alerts" | "settings">("alerts");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const pushedIds = useRef(new Set<string>());

  const notifications = useMemo(
    () => buildNotifications(summary, preferences),
    [summary, preferences],
  );
  const unreadCount = notifications.filter((item) => !readIds.has(item.id)).length;
  const hasImportantUnread = notifications.some(
    (item) => !readIds.has(item.id) && (item.tone === "danger" || item.tone === "warning"),
  );

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
      setReadIds(readSetFromStorage(READ_STORAGE_KEY));
      pushedIds.current = readSetFromStorage(PUSHED_STORAGE_KEY);
      setPreferences(readPreferences());
      void loadSummary();
    }, 0);

    const intervalId = window.setInterval(() => void loadSummary(), 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (!preferences.browserPush || permission !== "granted") return;

    notifications
      .filter((item) => item.tone === "danger" || item.tone === "warning")
      .forEach((item) => {
        if (pushedIds.current.has(item.id)) return;
        pushedIds.current.add(item.id);
        writeSetToStorage(PUSHED_STORAGE_KEY, pushedIds.current);
        showBrowserNotification(item);
      });
  }, [notifications, permission, preferences.browserPush]);

  function updatePreferences(next: NotificationPreferences) {
    setPreferences(next);
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  }

  function toggleRule(rule: NotificationRule) {
    updatePreferences({
      ...preferences,
      rules: {
        ...preferences.rules,
        [rule]: !preferences.rules[rule],
      },
    });
  }

  function updateExpenseLimit(value: string) {
    const numeric = Number(value);
    updatePreferences({
      ...preferences,
      expenseLimitPercent: Number.isFinite(numeric)
        ? Math.min(Math.max(Math.round(numeric), 50), 100)
        : DEFAULT_PREFERENCES.expenseLimitPercent,
    });
  }

  function markAllRead() {
    const next = new Set(notifications.map((item) => item.id));
    setReadIds(next);
    writeSetToStorage(READ_STORAGE_KEY, next);
  }

  function markOneRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    writeSetToStorage(READ_STORAGE_KEY, next);
  }

  async function enableBrowserPush() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    updatePreferences({
      ...preferences,
      browserPush: nextPermission === "granted",
    });
  }

  function disableBrowserPush() {
    updatePreferences({ ...preferences, browserPush: false });
  }

  function testBrowserPush() {
    if (permission !== "granted") return;
    showBrowserNotification({
      id: "test",
      title: "Push de prueba",
      body: "Las notificaciones del navegador están funcionando.",
      tone: "success",
      rule: "system",
    });
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "icon" : "sm"}
        className={cn(
          compact &&
            "relative h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
          !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificaciones"
        aria-expanded={open}
        title="Notificaciones"
      >
        {hasImportantUnread ? (
          <BellRing className="h-4 w-4 text-amber-400" aria-hidden="true" />
        ) : (
          <Bell className="h-4 w-4" aria-hidden="true" />
        )}
        {compact ? null : "Notificaciones"}
        {unreadCount > 0 ? (
          <span
            className={cn(
              "rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black",
              compact && "absolute -right-0.5 -top-0.5 min-w-4 px-1",
              !compact && "ml-[-4px]",
            )}
          >
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/35">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Centro financiero</p>
              <p className="text-xs text-muted-foreground">
                {permission === "granted" && preferences.browserPush
                  ? "Push activo"
                  : "Alertas en la app"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void loadSummary()}
                aria-label="Actualizar alertas"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTab((value) => (value === "alerts" ? "settings" : "alerts"))}
                aria-label="Configurar alertas"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex border-b border-border p-1">
            {(["alerts", "settings"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
                  tab === item
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(item)}
              >
                {item === "alerts" ? "Alertas" : "Reglas"}
              </button>
            ))}
          </div>

          {tab === "alerts" ? (
            <>
              <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                {notifications.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    isRead={readIds.has(item.id)}
                    onRead={() => markOneRead(item.id)}
                  />
                ))}
              </div>

              <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
                <Button type="button" variant="outline" size="sm" onClick={markAllRead}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Marcar leídas
                </Button>
                {permission === "granted" && preferences.browserPush ? (
                  <Button type="button" variant="outline" size="sm" onClick={testBrowserPush}>
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    Probar push
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={enableBrowserPush}>
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                    Activar push
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3 p-3">
              <PushStatus
                permission={permission}
                browserPush={preferences.browserPush}
                onEnable={enableBrowserPush}
                onDisable={disableBrowserPush}
                onTest={testBrowserPush}
              />
              <RuleToggle
                label="Disponible real negativo"
                description="Avisar cuando reservas y obligaciones dejan saldo negativo."
                checked={preferences.rules.realAvailable}
                onChange={() => toggleRule("realAvailable")}
              />
              <RuleToggle
                label="Gastos cerca del límite"
                description={`Avisar cuando gastos superan ${preferences.expenseLimitPercent}% de ingresos.`}
                checked={preferences.rules.expenseLimit}
                onChange={() => toggleRule("expenseLimit")}
              />
              <div className="rounded-lg border border-border p-3">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="expense-limit">
                  Límite de gastos
                </label>
                <input
                  id="expense-limit"
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={preferences.expenseLimitPercent}
                  onChange={(event) => updateExpenseLimit(event.target.value)}
                  className="mt-2 w-full accent-violet-500"
                />
              </div>
              <RuleToggle
                label="Obligaciones del mes"
                description="Recurrentes, metas y pagos de deuda próximos."
                checked={preferences.rules.obligations}
                onChange={() => toggleRule("obligations")}
              />
              <RuleToggle
                label="Presupuesto reservado"
                description="Dinero separado para categorías pendientes."
                checked={preferences.rules.budgetReserve}
                onChange={() => toggleRule("budgetReserve")}
              />
              <RuleToggle
                label="Deuda activa"
                description="Avisar si hay deuda activa total registrada."
                checked={preferences.rules.debt}
                onChange={() => toggleRule("debt")}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({
  item,
  isRead,
  onRead,
}: {
  item: NotificationItem;
  isRead: boolean;
  onRead: () => void;
}) {
  const Icon = item.tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition",
        isRead && "opacity-55",
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
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{item.title}</p>
            {!isRead ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-primary hover:text-primary/80"
                onClick={onRead}
              >
                Leída
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

function PushStatus({
  permission,
  browserPush,
  onEnable,
  onDisable,
  onTest,
}: {
  permission: NotificationPermission | "unsupported";
  browserPush: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onTest: () => void;
}) {
  if (permission === "unsupported") {
    return (
      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Este navegador no soporta notificaciones del sistema.
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-5 text-muted-foreground">
        Las notificaciones están bloqueadas en el navegador. Activá el permiso desde la configuración
        del sitio para recibir push.
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-semibold">
          {permission === "granted" && browserPush ? "Push del navegador activo" : "Push del navegador"}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Recibís avisos cuando la app está abierta y aparece una alerta nueva.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {permission === "granted" && browserPush ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={onDisable}>
              Pausar push
            </Button>
            <Button type="button" size="sm" onClick={onTest}>
              Probar push
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={onEnable} className="sm:col-span-2">
            Activar push
          </Button>
        )}
      </div>
    </div>
  );
}

function RuleToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-violet-500"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function buildNotifications(
  summary: DashboardSummary | null,
  preferences: NotificationPreferences,
): NotificationItem[] {
  if (!summary) {
    return [
      {
        id: "loading",
        title: "Sin datos todavía",
        body: "Cuando cargue el dashboard vas a ver alertas de presupuesto, obligaciones y disponible.",
        tone: "info",
        rule: "system",
      },
    ];
  }

  const { metrics, alerts } = summary;
  const items: NotificationItem[] = [];

  if (preferences.rules.realAvailable && metrics.realAvailable < 0) {
    items.push({
      id: `real-available-negative-${Math.round(metrics.realAvailable)}`,
      title: "Disponible real en negativo",
      body: `Te faltan ${formatMoney(Math.abs(metrics.realAvailable))} luego de reservas y obligaciones.`,
      tone: "danger",
      rule: "realAvailable",
    });
  }

  if (
    preferences.rules.expenseLimit &&
    metrics.income > 0 &&
    metrics.expenses / metrics.income >= preferences.expenseLimitPercent / 100
  ) {
    const percent = Math.round((metrics.expenses / metrics.income) * 100);
    items.push({
      id: `expenses-near-income-${percent}`,
      title: "Gastos cerca del límite",
      body: `Ya usaste ${percent}% de tus ingresos del mes.`,
      tone: metrics.expenses > metrics.income ? "danger" : "warning",
      rule: "expenseLimit",
    });
  }

  if (preferences.rules.budgetReserve && metrics.remainingReservedBudget > 0) {
    items.push({
      id: `budget-reserved-${Math.round(metrics.remainingReservedBudget)}`,
      title: "Presupuesto reservado",
      body: `Quedan ${formatMoney(metrics.remainingReservedBudget)} reservados para categorías pendientes.`,
      tone: "info",
      rule: "budgetReserve",
    });
  }

  if (preferences.rules.obligations && metrics.upcomingObligations > 0) {
    items.push({
      id: `upcoming-obligations-${Math.round(metrics.upcomingObligations)}`,
      title: "Obligaciones próximas",
      body: `Este mes tenés ${formatMoney(metrics.upcomingObligations)} entre recurrentes, metas y deuda.`,
      tone: "warning",
      rule: "obligations",
    });
  }

  if (preferences.rules.debt && metrics.totalOutstandingDebt > 0) {
    items.push({
      id: `active-debt-${Math.round(metrics.totalOutstandingDebt)}`,
      title: "Deuda activa registrada",
      body: `Tu deuda activa total es ${formatMoney(metrics.totalOutstandingDebt)}.`,
      tone: "warning",
      rule: "debt",
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
      rule: "system",
    });
  });

  if (items.length === 0) {
    items.push({
      id: "all-good",
      title: "Todo bajo control",
      body: "No hay alertas financieras importantes para este mes.",
      tone: "success",
      rule: "system",
    });
  }

  return items.slice(0, 8);
}

function showBrowserNotification(item: NotificationItem) {
  new Notification(item.title, {
    body: item.body,
    tag: item.id,
  });
}

function readSetFromStorage(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeSetToStorage(key: string, value: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(value).slice(-60)));
}

function readPreferences(): NotificationPreferences {
  try {
    const stored = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;

    return {
      browserPush: Boolean(parsed.browserPush),
      expenseLimitPercent:
        typeof parsed.expenseLimitPercent === "number"
          ? Math.min(Math.max(Math.round(parsed.expenseLimitPercent), 50), 100)
          : DEFAULT_PREFERENCES.expenseLimitPercent,
      rules: {
        ...DEFAULT_PREFERENCES.rules,
        ...(parsed.rules ?? {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
