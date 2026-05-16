import { z } from "zod";

export const qualitySignalsSchema = z.object({
  householdId: z.string().min(1),
});

export const bulkCategorizeSchema = z.object({
  householdId: z.string().min(1),
  transactionIds: z.array(z.string().min(1)).min(1).max(200),
  categoryId: z.string().min(1),
});

export type QualitySignalsInput = z.infer<typeof qualitySignalsSchema>;
export type BulkCategorizeInput = z.infer<typeof bulkCategorizeSchema>;
