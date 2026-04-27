import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateCategoryInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from "../schemas/categories";
import { assertHouseholdAccess } from "./households";

export async function createCategory(userProfileId: string, input: CreateCategoryInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await assertParentCategoryBelongsToHousehold(input.householdId, input.parentId);

  return prisma.category.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      type: input.type,
      color: input.color,
      icon: input.icon,
      parentId: input.parentId,
    },
  });
}

export async function listCategories(userProfileId: string, input: ListCategoriesInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  return prisma.category.findMany({
    where: {
      householdId: input.householdId,
      type: input.type,
      deletedAt: null,
      ...(input.includeArchived ? {} : { isArchived: false }),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function updateCategory(
  userProfileId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) {
  await assertCategoryAccess(userProfileId, categoryId, input.householdId);
  await assertParentCategoryBelongsToHousehold(input.householdId, input.parentId, categoryId);

  return prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      name: input.name,
      type: input.type,
      color: input.color,
      icon: input.icon,
      parentId: input.parentId,
    },
  });
}

export async function deleteCategory(
  userProfileId: string,
  categoryId: string,
  householdId: string,
) {
  await assertCategoryAccess(userProfileId, categoryId, householdId);

  return prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      deletedAt: new Date(),
      isArchived: true,
    },
  });
}

async function assertCategoryAccess(userProfileId: string, categoryId: string, householdId: string) {
  await assertHouseholdAccess(userProfileId, householdId);

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      householdId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  return category;
}

async function assertParentCategoryBelongsToHousehold(
  householdId: string,
  parentId?: string | null,
  categoryId?: string,
) {
  if (!parentId) {
    return;
  }

  if (parentId === categoryId) {
    throw new ForbiddenError("A category cannot be its own parent");
  }

  const parent = await prisma.category.findFirst({
    where: {
      id: parentId,
      householdId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!parent) {
    throw new ForbiddenError("Parent category does not belong to this household");
  }
}
