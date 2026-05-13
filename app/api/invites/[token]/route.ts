import { handleApiError, ok } from "@/server/api/http";
import { getInvitePreview } from "@/server/services/households";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const invite = await getInvitePreview(token);

    return ok(invite);
  } catch (error) {
    return handleApiError(error);
  }
}
