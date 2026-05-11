import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth/current-user";
import { UnauthorizedError } from "@/server/api/errors";

export async function POST() {
  try {
    const { userProfile } = await getCurrentUser();

    await prisma.userProfile.update({
      where: { id: userProfile.id },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Error al guardar progreso." }, { status: 500 });
  }
}
