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
  return (
    <div className="h-[260px] w-full">
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
                stroke={activeCategoryId === entry.id ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                style={{ cursor: onSelectCategory ? "pointer" : "default" }}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [formatMoney(Number(value)), String(name)]} />
        </PieChart>
      </ResponsiveContainer>
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
