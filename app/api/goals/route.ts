import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createGoalSchema, listGoalsSchema } from "../../../server/schemas/goals";
import { createGoal, listGoals } from "../../../server/services/goals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listGoalsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const goals = await listGoals(userProfile.id, input);

    return ok(goals);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createGoalSchema.parse(await request.json());
    const goal = await createGoal(userProfile.id, input);

    return created(goal);
  } catch (error) {
    return handleApiError(error);
  }
}
