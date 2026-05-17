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
  "/household",
  "/profile",
  "/settings",
  "/notifications",
  "/smart-import",
];

const PUBLIC_AUTH_PATHS = [
  "/auth/reset-password",
];

const requestLog = new Map<string, { count: number; resetAt: number }>();

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_RATE_POLICY = { limit: 120, windowSeconds: 60 };

function getRatePolicy(pathname: string) {
  if (pathname.startsWith("/api/ai/smart-import")) return { limit: 10, windowSeconds: 60 * 60 };
  if (pathname.startsWith("/api/ai/")) return { limit: 20, windowSeconds: 60 * 60 };
  if (pathname.startsWith("/api/onboarding/")) return { limit: 10, windowSeconds: 60 * 60 };
  if (pathname.includes("/import-candidates")) return { limit: 20, windowSeconds: 60 * 60 };
  return DEFAULT_RATE_POLICY;
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isSameOriginMutation(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/") || !MUTATING_METHODS.has(request.method)) {
    return true;
  }

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;

  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function isRateLimitedInMemory(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const entry = requestLog.get(key);
  const windowMs = windowSeconds * 1000;

  if (!entry || now > entry.resetAt) {
    requestLog.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;

  // Prune stale entries to prevent unbounded memory growth
  if (requestLog.size > 5_000) {
    for (const [k, v] of requestLog) {
      if (now > v.resetAt) requestLog.delete(k);
    }
  }

  return entry.count > limit;
}

async function isRateLimited(key: string, limit: number, windowSeconds: number) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return isRateLimitedInMemory(key, limit, windowSeconds);
  }

  const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", bucket],
      ["EXPIRE", bucket, String(windowSeconds)],
    ]),
  });

  if (!response.ok) {
    return isRateLimitedInMemory(key, limit, windowSeconds);
  }

  const data = (await response.json()) as Array<{ result?: unknown }>;
  const count = Number(data[0]?.result ?? 0);
  return count > limit;
}

function rateLimitedResponse(windowSeconds: number) {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." },
    { status: 429, headers: { "Retry-After": String(windowSeconds) } },
  );
}

// ---------------------------------------------------------------------------
// Proxy (Next.js 16 equivalent of middleware)
// ---------------------------------------------------------------------------
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));

  if (
    process.env.MAINTENANCE_MODE === "1" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/analytics")
  ) {
    return NextResponse.json(
      { error: "Estamos haciendo mantenimiento breve. Volvé a intentar en unos minutos." },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  if (pathname.startsWith("/api/")) {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json(
        { error: "Solicitud rechazada por protección CSRF." },
        { status: 403 },
      );
    }

    const policy = getRatePolicy(pathname);
    const ip = getClientIp(request);

    if (await isRateLimited(`ip:${ip}:${pathname}`, policy.limit, policy.windowSeconds)) {
      return rateLimitedResponse(policy.windowSeconds);
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

  if (pathname.startsWith("/api/") && user) {
    const policy = getRatePolicy(pathname);
    if (await isRateLimited(`user:${user.id}:${pathname}`, policy.limit, policy.windowSeconds)) {
      return rateLimitedResponse(policy.windowSeconds);
    }
  }

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
