import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Private routes that require authentication
// ---------------------------------------------------------------------------
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/budgets",
  "/categories",
  "/debts",
  "/goals",
  "/recurring",
  "/reports",
];

const PUBLIC_AUTH_PATHS = [
  "/auth/reset-password",
];

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per Edge instance)
// Protects against basic abuse within a warm Vercel Edge instance.
// For high-traffic production, complement with Upstash Ratelimit + Vercel WAF.
// ---------------------------------------------------------------------------
const requestLog = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 120;   // requests per window
const WINDOW_MS  = 60_000; // 1 minute

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = requestLog.get(key);

  if (!entry || now > entry.resetAt) {
    requestLog.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;

  // Prune stale entries to prevent unbounded memory growth
  if (requestLog.size > 5_000) {
    for (const [k, v] of requestLog) {
      if (now > v.resetAt) requestLog.delete(k);
    }
  }

  return entry.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// Proxy (Next.js 16 equivalent of middleware)
// ---------------------------------------------------------------------------
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));

  // --- Rate limit API routes ---
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  // --- Supabase session refresh ---
  // Required by @supabase/ssr to keep access tokens alive between requests.
  // Without this, tokens expire and users get silently logged out.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Use getUser() — validates JWT server-side. Never use getSession() here.
  const { data: { user } } = await supabase.auth.getUser();

  // --- Route protection ---
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPrivate && !user && !isPublicAuthPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
