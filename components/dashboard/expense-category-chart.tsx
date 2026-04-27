"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type ExpenseCategoryChartItem = {
  name: string;
  value: number;
  color: string;
};

type ExpenseCategoryChartProps = {
  data: ExpenseCategoryChartItem[];
};

export function ExpenseCategoryChart({ data }: ExpenseCategoryChartProps) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [formatMoney(Number(value)), "Gasto"]} />
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
