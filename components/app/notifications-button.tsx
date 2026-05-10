"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
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
  panelClassName?: string;
  embedded?: boolean;
};

const READ_STORAGE_KEY = "financial-os-read-notifications";
const PUSHED_STORAGE_KEY = "financial-os-pushed-notifications";
const PREFS_STORAGE_KEY = "financial-os-notification-preferences";

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

export function NotificationsButton({ compact = false, className, panelClassName, embedded = false }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
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
  const activeRuleCount = Object.values(preferences.rules).filter(Boolean).length;

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
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

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

  const showPanel = embedded || open;

  return (
    <div className={embedded ? "w-full" : "relative"}>
      {!embedded ? (
      <Button
        asChild
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "icon" : "sm"}
        className={cn(
          compact &&
            "relative h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
          !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
          className,
        )}
        aria-label="Notificaciones"
        title="Notificaciones"
      >
        <Link href="/notifications">
          {hasImportantUnread ? (
            <BellRing className="h-4 w-4 text-amber-400" aria-hidden="true" />
          ) : (
            <Bell className="h-4 w-4" aria-hidden="true" />
          )}
          {compact ? null : "Avisos"}
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
        </Link>
      </Button>
      ) : null}

      {showPanel ? (
        <>
          {/* Backdrop mobile: cierra al tocar fuera, bloquea scroll sin tocar body */}
          {!embedded ? <div
            className="fixed inset-0 z-[69] lg:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{ touchAction: "none" }}
          /> : null}
          <div className={cn(
            embedded
              ? "w-full overflow-hidden rounded-[var(--v2-radius-lg)] border border-white/[0.14] bg-zinc-950 shadow-2xl shadow-black/40"
              : "absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[var(--v2-radius-lg)] border border-white/[0.14] bg-zinc-950 shadow-2xl shadow-black/60",
            panelClassName,
          )}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Centro financiero</p>
              <p className="text-xs text-muted-foreground">
                {permission === "granted" && preferences.browserPush
                  ? `${activeRuleCount} reglas activas + navegador`
                  : `${activeRuleCount} reglas activas en la app`}
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

          <div className="flex border-b border-white/10 bg-zinc-950 p-1">
            {(["alerts", "settings"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  tab === item
                    ? "bg-zinc-800 text-teal-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(item)}
              >
                {item === "alerts" ? "Alertas" : "Configuración"}
              </button>
            ))}
          </div>

          {tab === "alerts" ? (
            <>
            <div className={cn("space-y-2 bg-zinc-950 p-3", !embedded && "max-h-[360px] overflow-y-auto")}>
                {notifications.length === 1 && notifications[0].id === "all-good" ? (
                  <EmptyNotifications />
                ) : (
                  notifications.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      isRead={readIds.has(item.id)}
                      onRead={() => markOneRead(item.id)}
                    />
                  ))
                )}
              </div>

              <div className="grid gap-2 border-t border-white/10 bg-zinc-950 p-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={permission === "granted" && preferences.browserPush ? "sm:col-span-2" : undefined}
                  onClick={markAllRead}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Marcar leídas
                </Button>
                {permission === "granted" && preferences.browserPush ? null : (
                  <Button type="button" size="sm" onClick={enableBrowserPush}>
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                    Activar avisos
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className={cn("space-y-3 bg-zinc-950 p-3", !embedded && "max-h-[430px] overflow-y-auto")}>
              <PushStatus
                permission={permission}
                browserPush={preferences.browserPush}
                activeRuleCount={activeRuleCount}
                onEnable={enableBrowserPush}
                onDisable={disableBrowserPush}
              />
              <section className="rounded-2xl border border-white/[0.14] bg-zinc-900 p-3 shadow-inner shadow-black/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Señales que querés recibir</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Elegí qué merece interrumpirte y qué puede esperar.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-teal-300/20 bg-teal-300/10 px-2.5 py-1 text-[11px] font-semibold text-teal-100">
                    {activeRuleCount}/5
                  </span>
                </div>

                <div className="grid gap-2">
                  <RuleToggle
                    label="Disponible real negativo"
                    description="Reservas y obligaciones dejan el mes sin margen."
                    checked={preferences.rules.realAvailable}
                    tone="danger"
                    onChange={() => toggleRule("realAvailable")}
                  />
                  <RuleToggle
                    label="Gastos cerca del límite"
                    description={`Cuando superan ${preferences.expenseLimitPercent}% de ingresos.`}
                    checked={preferences.rules.expenseLimit}
                    tone="warning"
                    onChange={() => toggleRule("expenseLimit")}
                  />
                  <ExpenseLimitSlider
                    value={preferences.expenseLimitPercent}
                    onChange={updateExpenseLimit}
                    disabled={!preferences.rules.expenseLimit}
                  />
                  <RuleToggle
                    label="Obligaciones del mes"
                    description="Recurrentes, metas y deuda próximos."
                    checked={preferences.rules.obligations}
                    tone="warning"
                    onChange={() => toggleRule("obligations")}
                  />
                  <RuleToggle
                    label="Presupuesto reservado"
                    description="Dinero separado para categorías pendientes."
                    checked={preferences.rules.budgetReserve}
                    tone="info"
                    onChange={() => toggleRule("budgetReserve")}
                  />
                  <RuleToggle
                    label="Deuda activa"
                    description="Saldo total de compromisos todavía abiertos."
                    checked={preferences.rules.debt}
                    tone="neutral"
                    onChange={() => toggleRule("debt")}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
        </>
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
        "rounded-2xl border p-3 transition",
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
                className="text-[11px] font-semibold text-teal-200 hover:text-teal-100"
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

function EmptyNotifications() {
  return (
    <div className="rounded-2xl border border-white/[0.14] bg-zinc-900 p-5 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold">Todo bajo control</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        No hay alertas financieras importantes para este mes.
      </p>
    </div>
  );
}

function PushStatus({
  permission,
  browserPush,
  activeRuleCount,
  onEnable,
  onDisable,
}: {
  permission: NotificationPermission | "unsupported";
  browserPush: boolean;
  activeRuleCount: number;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const isEnabled = permission === "granted" && browserPush;

  if (permission === "unsupported") {
    return (
      <div className="rounded-2xl border border-white/[0.14] bg-zinc-900 p-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-zinc-800 text-zinc-300">
            <BellOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Avisos no disponibles</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Este navegador no permite notificaciones del sistema. Las alertas quedan dentro de la app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-300/12 text-rose-100">
            <BellOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-100">Permiso bloqueado</p>
            <p className="mt-1 text-xs leading-5 text-zinc-300">
              Activá el permiso desde la configuración del sitio para recibir avisos del navegador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border p-4",
      isEnabled
        ? "border-teal-300/25 bg-teal-950/50"
        : "border-white/[0.14] bg-zinc-900",
    )}>
      <div className="flex gap-3">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          isEnabled
            ? "border-teal-300/20 bg-teal-300/10 text-teal-100"
            : "border-white/10 bg-zinc-800 text-zinc-300",
        )}>
          {isEnabled ? <Radio className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {isEnabled ? "Canal de avisos activo" : "Canal de avisos en pausa"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isEnabled
                  ? `Te avisamos en el navegador cuando aparezca una señal crítica entre tus ${activeRuleCount} reglas.`
                  : "Las señales quedan visibles en la app hasta que actives avisos del navegador."}
              </p>
            </div>
            <span className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
              isEnabled ? "bg-teal-300/15 text-teal-100" : "bg-zinc-800 text-zinc-400",
            )}>
              {isEnabled ? "Activo" : "Pausado"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Modo</p>
              <p className="mt-1 truncate text-xs font-semibold text-zinc-100">
                {isEnabled ? "Navegador + app" : "Solo app"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Reglas</p>
              <p className="mt-1 text-xs font-semibold text-zinc-100">{activeRuleCount} activas</p>
            </div>
          </div>
          <div className="mt-3">
            {isEnabled ? (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={onDisable}>
                <BellOff className="h-4 w-4" aria-hidden="true" />
                Pausar avisos del navegador
              </Button>
            ) : (
              <Button type="button" size="sm" className="w-full" onClick={onEnable}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Activar avisos del navegador
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleToggle({
  label,
  description,
  checked,
  tone,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  tone: "danger" | "warning" | "info" | "neutral";
  onChange: () => void;
}) {
  const toneClass = {
    danger: "bg-rose-300/12 text-rose-100",
    warning: "bg-amber-300/12 text-amber-100",
    info: "bg-sky-300/12 text-sky-100",
    neutral: "bg-zinc-300/10 text-zinc-200",
  }[tone];

  return (
    <label className={cn(
      "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition",
      checked
        ? "border-white/[0.16] bg-zinc-800"
        : "border-white/10 bg-zinc-950/70 opacity-80 hover:opacity-100",
    )}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", toneClass)}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border transition",
          checked ? "border-teal-300/30 bg-teal-300/25" : "border-white/10 bg-zinc-700",
        )}
      >
        <span className={cn(
          "absolute top-1 h-4 w-4 rounded-full bg-white transition",
          checked ? "left-5" : "left-1",
        )} />
      </span>
    </label>
  );
}

function ExpenseLimitSlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn(
      "rounded-2xl border border-white/10 bg-zinc-950/70 p-3 transition",
      disabled && "opacity-45",
    )}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="expense-limit">
          Umbral de gasto
        </label>
        <span className="rounded-full border border-white/10 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-100">
          {value}%
        </span>
      </div>
      <input
        id="expense-limit"
        type="range"
        min="50"
        max="100"
        step="5"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full accent-teal-300 disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex justify-between text-[10px] font-medium text-zinc-600">
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
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
