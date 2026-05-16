"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SensitiveAmount } from "@/components/app/sensitive-amount";

export type ExpenseCategoryChartItem = {
  id: string;
  name: string;
  value: number;
  color: string;
};

type ExpenseCategoryChartProps = {
  data: ExpenseCategoryChartItem[];
  activeCategoryId?: string;
  onSelectCategory?: (categoryId: string) => void;
};

export function ExpenseCategoryChart({ data, activeCategoryId, onSelectCategory }: ExpenseCategoryChartProps) {
  const activeItem = data.find((item) => item.id === activeCategoryId);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const activePercent = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : 0;

  return (
    <div className="relative h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={3}
            onClick={(entry) => {
              const categoryId = (entry as Partial<ExpenseCategoryChartItem>)?.id;
              if (typeof categoryId === "string") {
                onSelectCategory?.(categoryId);
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.id}
                fill={entry.color}
                opacity={!activeCategoryId || activeCategoryId === entry.id ? 1 : 0.35}
                stroke={activeCategoryId === entry.id ? "hsl(var(--v2-text))" : "hsl(var(--v2-bg))"}
                strokeWidth={activeCategoryId === entry.id ? 3 : 1.5}
                style={{ cursor: onSelectCategory ? "pointer" : "default" }}
              />
            ))}
          </Pie>
          <Tooltip content={<ExpenseCategoryTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border border-border bg-card/95 text-center shadow-md">
          <span className={`${activeItem ? "text-2xl" : "max-w-[86px] truncate text-sm"} font-semibold tabular-nums text-foreground`}>
            {activeItem ? `${activePercent}%` : <SensitiveAmount value={formatMoney(total)} />}
          </span>
          <span className="mt-0.5 max-w-[76px] truncate text-[10px] font-medium text-muted-foreground">{activeItem?.name ?? "Total"}</span>
        </div>
      </div>
    </div>
  );
}

function ExpenseCategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
}) {
  const item = payload?.[0];
  if (!active || !item) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      <p className="font-medium text-muted-foreground">{String(item.name ?? "Categoría")}</p>
      <p className="mt-1 font-semibold tabular-nums">
        <SensitiveAmount value={formatMoney(Number(item.value ?? 0))} />
      </p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
