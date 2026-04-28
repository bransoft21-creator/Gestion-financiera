import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";
import type { CreateGoalInput, ListGoalsInput, UpdateGoalInput } from "../schemas/goals";
import { assertHouseholdAccess } from "./households";

export async function listGoals(userProfileId: string, input: ListGoalsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const goals = await prisma.goal.findMany({
    where: {
      householdId: input.householdId,
      status: input.status,
      deletedAt: null,
    },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
  });

  return goals.map(serializeGoal);
}

export async function createGoal(userProfileId: string, input: CreateGoalInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const goal = await prisma.goal.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      currency: input.currency,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount,
      requiredMonthlyAmount: input.requiredMonthlyAmount,
      targetDate: input.targetDate,
      status: input.status,
      notes: input.notes,
    },
  });

  return serializeGoal(goal);
}

export async function updateGoal(userProfileId: string, goalId: string, input: UpdateGoalInput) {
  await assertGoalAccess(userProfileId, goalId, input.householdId);

  const goal = await prisma.goal.update({
    where: {
      id: goalId,
    },
    data: {
      name: input.name,
      currency: input.currency,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount,
      requiredMonthlyAmount: input.requiredMonthlyAmount,
      targetDate: input.targetDate,
      status: input.status,
      notes: input.notes,
    },
  });

  return serializeGoal(goal);
}

export async function deleteGoal(userProfileId: string, goalId: string, householdId: string) {
  await assertGoalAccess(userProfileId, goalId, householdId);

  return prisma.goal.update({
    where: {
      id: goalId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

async function assertGoalAccess(userProfileId: string, goalId: string, householdId: string) {
  await assertHouseholdAccess(userProfileId, householdId);

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      householdId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!goal) {
    throw new NotFoundError("Goal not found");
  }

  return goal;
}

type GoalRecord = Prisma.GoalGetPayload<Record<string, never>>;

function serializeGoal(goal: GoalRecord) {
  return {
    id: goal.id,
    householdId: goal.householdId,
    name: goal.name,
    currency: goal.currency,
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
    requiredMonthlyAmount: goal.requiredMonthlyAmount != null ? Number(goal.requiredMonthlyAmount) : null,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status,
    notes: goal.notes,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
