import { type NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { markActivityRead } from "@/server/services/activity";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    await markActivityRead(userProfile.id, id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
