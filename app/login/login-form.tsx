"use client";

import { useState } from "react";
import { BarChart3, Eye, EyeOff, Loader2, Target, TrendingUp, WalletCards } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

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
        setMessage(result.error.message);
        setIsLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error inesperado. Intentá de nuevo.");
      setIsLoading(false);
    }
  }

  const bullets = [
    { icon: BarChart3, title: "Disponible real", desc: "Calculado restando presupuestos reservados, metas y deudas próximas." },
    { icon: Target, title: "Control total", desc: "Presupuestos, metas de ahorro, gastos fijos y deudas en un solo lugar." },
    { icon: TrendingUp, title: "Tendencias claras", desc: "Gráficos de tendencia mensual para entender tus hábitos financieros." },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Panel izquierdo (solo desktop) ── */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-r border-border bg-gradient-to-br from-[hsl(228,22%,8%)] to-[hsl(250,25%,10%)] px-16 py-16 lg:flex lg:w-[58%]">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,.18)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-[-60px] right-[60px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,.14)_0%,transparent_70%)]" />

        {/* Logo */}
        <div className="mb-14 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/35">
            <WalletCards className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-foreground">Finance Control</span>
        </div>

        {/* Tagline */}
        <h1 className="mb-4 text-[44px] font-extrabold leading-[1.1] tracking-tight text-foreground">
          Tu dinero,<br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            bajo control real.
          </span>
        </h1>
        <p className="mb-14 max-w-md text-base leading-relaxed text-muted-foreground">
          Visualizá tu situación financiera real, no solo ingresos menos gastos.
          Presupuestos, metas y deudas integrados.
        </p>

        {/* Bullets */}
        <div className="space-y-6">
          {bullets.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-400">
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
          <div className="mb-9 flex flex-col items-center lg:hidden">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/35">
              <WalletCards className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <p className="text-lg font-extrabold text-foreground">Finance Control</p>
          </div>

          {/* Tabs */}
          <div className="mb-7 grid grid-cols-2 rounded-xl border border-border bg-card p-1">
            {(["login", "register"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setFieldErrors({}); setMessage(null); }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === tab
                    ? "bg-primary text-white shadow-md shadow-violet-500/35"
                    : "text-muted-foreground"
                }`}
              >
                {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nombre
                </label>
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Tu nombre"
                  className="h-[46px] w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
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
                className="h-[46px] w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
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
                  className="h-[46px] w-full rounded-xl border border-border bg-card px-4 pr-12 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            {message && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-500/35 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isLoading ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>

            {mode === "login" && (
              <p className="text-center text-sm text-muted-foreground">
                ¿No tenés cuenta?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setFieldErrors({}); setMessage(null); }}
                  className="font-semibold text-primary"
                >
                  Registrarse
                </button>
              </p>
            )}
          </form>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/40">
            Finance Control · Gestión financiera profesional
          </p>
        </div>
      </div>
    </div>
  );
}
