"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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
                opacity={!activeCategoryId || activeCategoryId === entry.id ? 1 : 0.45}
                stroke={activeCategoryId === entry.id ? "hsl(var(--v2-text))" : "hsl(var(--v2-bg))"}
                strokeWidth={activeCategoryId === entry.id ? 3 : 2}
                style={{ cursor: onSelectCategory ? "pointer" : "default" }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
            contentStyle={{
              background: "hsl(var(--v2-surface-raised))",
              border: "1px solid hsl(var(--v2-border-strong))",
              borderRadius: 16,
              color: "hsl(var(--v2-text))",
              boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border border-white/10 bg-zinc-950/88 text-center shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur">
          <span className={`${activeItem ? "text-2xl" : "max-w-[86px] truncate text-sm"} font-semibold tabular-nums text-white`}>
            {activeItem ? `${activePercent}%` : formatMoney(total)}
          </span>
          <span className="mt-0.5 max-w-[76px] truncate text-[10px] font-medium text-zinc-500">{activeItem?.name ?? "Total"}</span>
        </div>
      </div>
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
