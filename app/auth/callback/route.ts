import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler.
 * Supabase redirects here after Google (or any provider) auth completes.
 * Exchanges the one-time code for a session, then routes the user based on
 * whether they have completed onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Use the canonical app URL so the redirect works correctly on Vercel
  // even behind a reverse-proxy (x-forwarded-host).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", baseUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(new URL("/login?error=oauth", baseUrl));
  }

  const userId = data.session.user.id;

  // Lightweight check: only fetch the field we need to decide the redirect.
  // Full profile/household initialisation happens inside getCurrentUser() when
  // the user lands on /onboarding (first visit) or (private)/layout (returning).
  const profile = await prisma.userProfile.findUnique({
    where: { supabaseId: userId },
    select: { onboardingCompletedAt: true },
  });

  const redirectPath = !profile || !profile.onboardingCompletedAt ? "/onboarding" : "/dashboard";

  return NextResponse.redirect(new URL(redirectPath, baseUrl));
}
