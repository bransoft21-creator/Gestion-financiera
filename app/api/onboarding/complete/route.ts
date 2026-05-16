import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth/current-user";
import { UnauthorizedError } from "@/server/api/errors";
import { handleApiError } from "@/server/api/http";
import { completeOnboardingSchema, normalizeOnboardingGoals } from "@/server/schemas/onboarding";

export async function POST(request: Request) {
  try {
    const { userProfile } = await getCurrentUser();
    const body = await request.json().catch(() => ({})) as unknown;
    const input = completeOnboardingSchema.parse(body);
    const onboardingGoals = normalizeOnboardingGoals(input.goals);

    await prisma.userProfile.update({
      where: { id: userProfile.id },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingGoals,
      },
    });

    return NextResponse.json({ success: true, goals: onboardingGoals });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    return handleApiError(error);
  }
}
