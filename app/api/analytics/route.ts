import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logEvent } from "@/server/api/logging";

export const runtime = "nodejs";

const analyticsSchema = z.object({
  event: z.string().min(1).max(80),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = analyticsSchema.parse(await request.json());
    logEvent("info", "product.event", {
      event: body.event,
      properties: body.properties,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
