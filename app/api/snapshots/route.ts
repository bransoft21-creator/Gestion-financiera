import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { captureMonthlySnapshot, listMonthlySnapshots } from "@/server/services/snapshots";

export const runtime = "nodejs";

const listSchema = z.object({
  householdId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(24).default(12),
});

const captureSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const snapshots = await listMonthlySnapshots(userProfile.id, input.householdId, input.limit);
    return ok(snapshots);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);
    const input = captureSchema.parse(await request.json());
    const snapshot = await captureMonthlySnapshot(
      userProfile.id,
      household.id,
      input.year,
      input.month,
    );
    return created(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
