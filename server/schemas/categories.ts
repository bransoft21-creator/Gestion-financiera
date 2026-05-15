import { CategoryType } from "@prisma/client";
import { z } from "zod";

const categoryTypeValues = Object.values(CategoryType) as [CategoryType, ...CategoryType[]];

export const createCategorySchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.enum(categoryTypeValues),
  color: z.string().trim().max(32).optional(),
  icon: z.string().trim().max(64).optional(),
  parentId: z.string().min(1).optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  householdId: z.string().min(1),
  color: z.string().trim().max(32).nullable().optional(),
  icon: z.string().trim().max(64).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const listCategoriesSchema = z.object({
  householdId: z.string().min(1),
  type: z.enum(categoryTypeValues).optional(),
  includeArchived: z.coerce.boolean().default(false),
});

export const mergeCategoriesSchema = z.object({
  householdId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
}).refine((data) => data.fromId !== data.toId, {
  message: "Las categorías de origen y destino deben ser distintas.",
  path: ["toId"],
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
export type MergeCategoriesInput = z.infer<typeof mergeCategoriesSchema>;
