"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, BarChart3, Eye, EyeOff, Loader2, Target, TrendingUp } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register" | "forgot";

function getCallbackUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}/auth/callback`;
}

function getPasswordRecoveryUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}/auth/reset-password`;
}

function humanizeAuthError(raw: string): string {
  const msg = raw.toLowerCase();

  // ── Credenciales ──────────────────────────────────────────────────────────
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.";
  }
  if (msg.includes("email already registered") || msg.includes("user already registered") || msg.includes("already registered")) {
    return "Ya existe una cuenta con ese email. Podés iniciar sesión directamente.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirmá tu email antes de entrar. Revisá tu bandeja de entrada.";
  }
  if (msg.includes("password should be at least") || msg.includes("weak password") || msg.includes("should be at least")) {
    return "La contraseña es muy corta. Usá al menos 6 caracteres.";
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (msg.includes("email rate limit") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("too many")) {
    return "Demasiados intentos. Esperá unos minutos antes de volver a intentar.";
  }

  // ── Red ───────────────────────────────────────────────────────────────────
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Error de conexión. Verificá tu internet e intentá de nuevo.";
  }

  // ── Tokens / links ────────────────────────────────────────────────────────
  if (msg.includes("expired") || msg.includes("token has expired")) {
    return "El enlace expiró. Solicitá uno nuevo desde el login.";
  }

  // ── Registro deshabilitado ────────────────────────────────────────────────
  if (msg.includes("signup") && msg.includes("disabled")) {
    return "El registro no está disponible en este momento.";
  }

  // ── OAuth / Google ────────────────────────────────────────────────────────
  if (msg.includes("provider disabled") || msg.includes("provider is not enabled")) {
    return "El inicio de sesión con Google no está disponible en este momento.";
  }
  if (msg.includes("redirect_uri_mismatch") || msg.includes("redirect uri")) {
    return "La configuración de acceso no está correcta. Contactá al soporte.";
  }
  if (msg.includes("access_denied") || msg.includes("access denied")) {
    return "Cancelaste el acceso con Google.";
  }
  if (msg.includes("popup_closed") || msg.includes("popup closed")) {
    return "Cerraste la ventana de Google antes de completar el ingreso.";
  }
  if (msg.includes("oauth") || msg.includes("provider error")) {
    return "No pudimos completar el ingreso con Google. Intentá nuevamente.";
  }

  return "Algo salió mal. Intentá de nuevo en un momento.";
}

function humanizeCallbackError(code: string): string | null {
  if (code === "oauth") {
    return "No pudimos completar el ingreso con Google. Intentá de nuevo.";
  }
  return null;
}

/* ── Google logo SVG ─────────────────────────────────────────────────────── */

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.253 17.64 11.945 17.64 9.2Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

type LoginFormProps = {
  initialError?: string;
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialError ? (humanizeCallbackError(initialError) ?? null) : null,
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const isAnyLoading = isLoading || isGoogleLoading;

  function switchMode(next: AuthMode) {
    setMode(next);
    setFieldErrors({});
    setMessage(null);
    setShowPassword(false);
  }

  async function handleGoogleLogin() {
    if (isAnyLoading) return;
    setIsGoogleLoading(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getCallbackUrl() },
      });
      if (error) {
        setMessage(humanizeAuthError(error.message));
        setIsGoogleLoading(false);
      }
      // On success the browser is redirected to Google — no further code runs.
    } catch (err) {
      setMessage(humanizeAuthError(err instanceof Error ? err.message : "unexpected error"));
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const email = (formData.get("email") as string ?? "").trim();
    const password = (formData.get("password") as string ?? "").trim();
    const name = (formData.get("name") as string ?? "").trim();

    const errors: { email?: string; password?: string; name?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Ingresá un email válido.";
    if (password.length < 6) errors.password = "Mínimo 6 caracteres.";
    if (mode === "register" && name.length < 2) errors.name = "Ingresá tu nombre.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });

      if (result.error) {
        setMessage(humanizeAuthError(result.error.message));
        setIsLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setMessage(err instanceof Error ? humanizeAuthError(err.message) : "Error inesperado. Intentá de nuevo.");
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const email = ((formData.get("email") as string) ?? "").trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldErrors({ email: "Ingresá un email válido." });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryUrl(),
      });

      if (error) {
        setMessage("No pudimos enviar el correo. Revisá el email e intentá de nuevo.");
        setIsLoading(false);
        return;
      }

      setMessage("Te enviamos un enlace para cambiar tu contraseña.");
      setIsLoading(false);
    } catch {
      setMessage("No pudimos enviar el correo. Intentá de nuevo en un momento.");
      setIsLoading(false);
    }
  }

  const bullets = [
    { icon: BarChart3, title: "Disponible real", desc: "Tu margen después de reservas, metas, deudas y compromisos próximos." },
    { icon: Target, title: "Plan con intención", desc: "Cada peso importante queda asignado antes de diluirse en movimientos chicos." },
    { icon: TrendingUp, title: "Patrones claros", desc: "Señales mensuales para entender qué cambió y dónde conviene mirar." },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Panel izquierdo (solo desktop) ── */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-r border-white/10 bg-zinc-950 px-16 py-16 lg:flex lg:w-[58%]">
        <div className="mb-14 flex items-center gap-3.5">
          <Image src="/icons/Meridian.png" alt="Meridian" width={52} height={52} className="select-none" priority />
          <span className="text-[22px] font-bold tracking-tight text-foreground">Meridian</span>
        </div>

        <h1 className="mb-4 text-[44px] font-semibold leading-[1.05] text-foreground">
          Tu dinero,<br />
          <span className="v2-text-gradient">con perspectiva propia.</span>
        </h1>
        <p className="mb-14 max-w-md text-base leading-relaxed text-muted-foreground">
          Entendé dónde estás, qué cambió y cuál es el próximo movimiento razonable.
        </p>

        <div className="space-y-6">
          {bullets.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-teal-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel derecho (form) ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="fade-in w-full max-w-[420px]">
          {/* Logo mobile */}
          <div className="mb-10 flex flex-col items-center pt-2 lg:hidden">
            <Image src="/icons/Meridian.png" alt="Meridian" width={80} height={80} className="mb-5 select-none" priority />
            <p className="text-[26px] font-bold tracking-tight text-foreground">Meridian</p>
            <p className="mt-2 text-sm text-zinc-400">Tu perspectiva financiera</p>
          </div>

          {/* ── Google button — visible in login + register, hidden in forgot ── */}
          {mode !== "forgot" && (
            <>
              <button
                type="button"
                disabled={isAnyLoading}
                onClick={handleGoogleLogin}
                className="v2-focus-ring mb-5 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] text-sm font-semibold text-foreground transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleLogo />
                )}
                {isGoogleLoading ? "Redirigiendo…" : "Continuar con Google"}
              </button>

              <div className="relative mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-xs text-zinc-500">o continuá con email</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
            </>
          )}

          {/* ── Tabs login / register ── */}
          {mode !== "forgot" ? (
            <div className="mb-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1">
              {(["login", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  disabled={isAnyLoading}
                  onClick={() => switchMode(tab)}
                  className={`rounded-[14px] py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                    mode === tab
                      ? "bg-white text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.10)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-7">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mb-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver al login
              </button>
              <h1 className="text-2xl font-semibold text-foreground">Recuperar contraseña</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Te vamos a enviar un enlace seguro para crear una contraseña nueva.
              </p>
            </div>
          )}

          {/* ── Forgot form ── */}
          {mode === "forgot" ? (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@ejemplo.com"
                  required
                  disabled={isLoading}
                  className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-foreground outline-none transition hover:bg-white/[0.07] disabled:opacity-60"
                />
                {fieldErrors.email && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>}
              </div>

              {message && (
                <p className="rounded-2xl border border-teal-300/20 bg-teal-400/10 p-3 text-sm text-teal-50">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="v2-focus-ring mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isLoading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          ) : (
            /* ── Login / register form ── */
            <form key={mode} className="space-y-5" onSubmit={handleSubmit}>
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nombre
                  </label>
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Tu nombre"
                    disabled={isAnyLoading}
                    className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-foreground outline-none transition hover:bg-white/[0.07] disabled:opacity-60"
                  />
                  {fieldErrors.name && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.name}</p>}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@ejemplo.com"
                  required
                  disabled={isAnyLoading}
                  className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-foreground outline-none transition hover:bg-white/[0.07] disabled:opacity-60"
                />
                {fieldErrors.email && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    required
                    disabled={isAnyLoading}
                    className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 pr-12 text-sm text-foreground outline-none transition hover:bg-white/[0.07] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                      : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.password}</p>}
              </div>

              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-sm font-semibold text-teal-200 transition hover:text-teal-100"
                  >
                    Olvidé mi contraseña
                  </button>
                </div>
              )}

              {message && (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isAnyLoading}
                className="v2-focus-ring mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isLoading
                  ? mode === "login" ? "Entrando…" : "Creando cuenta…"
                  : mode === "login"
                    ? "Iniciar sesión"
                    : "Crear cuenta"}
              </button>

              {mode === "login" && (
                <p className="text-center text-sm text-muted-foreground">
                  ¿No tenés cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-semibold text-teal-200"
                  >
                    Registrarse
                  </button>
                </p>
              )}
            </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground/40">
            Meridian · Tu perspectiva financiera
          </p>
        </div>
      </div>
    </div>
  );
}
