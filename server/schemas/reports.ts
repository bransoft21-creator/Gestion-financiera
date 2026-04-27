import { z } from "zod";

export const monthlyReportSchema = z.object({
  householdId: z.string().min(1),
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
