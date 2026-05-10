"use client";

import { useState } from "react";
import { BarChart3, Eye, EyeOff, Loader2, Sparkles, Target, TrendingUp } from "lucide-react";
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
    { icon: BarChart3, title: "Disponible real", desc: "Tu margen después de reservas, metas, deudas y compromisos próximos." },
    { icon: Target, title: "Plan con intención", desc: "Cada peso importante queda asignado antes de diluirse en movimientos chicos." },
    { icon: TrendingUp, title: "Patrones claros", desc: "Señales mensuales para entender qué cambió y dónde conviene mirar." },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Panel izquierdo (solo desktop) ── */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-r border-white/10 bg-zinc-950 px-16 py-16 lg:flex lg:w-[58%]">
        {/* Logo */}
        <div className="mb-14 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-teal-100 shadow-[0_18px_55px_rgba(45,212,191,0.12)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-foreground">Financial OS</span>
        </div>

        {/* Tagline */}
        <h1 className="mb-4 text-[44px] font-semibold leading-[1.05] text-foreground">
          Tu sistema financiero,<br />
          <span className="v2-text-gradient">con lectura propia.</span>
        </h1>
        <p className="mb-14 max-w-md text-base leading-relaxed text-muted-foreground">
          Entendé qué está pasando, qué cambió y cuál es el próximo movimiento razonable.
        </p>

        {/* Bullets */}
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
          <div className="mb-9 flex flex-col items-center lg:hidden">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.07] text-teal-100 shadow-[0_18px_55px_rgba(45,212,191,0.12)]">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-lg font-extrabold text-foreground">Financial OS</p>
          </div>

          {/* Tabs */}
          <div className="mb-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1">
            {(["login", "register"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setFieldErrors({}); setMessage(null); }}
                className={`rounded-[14px] py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === tab
                    ? "bg-white text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.10)]"
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
                  className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-foreground outline-none transition hover:bg-white/[0.07]"
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
                className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-foreground outline-none transition hover:bg-white/[0.07]"
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
                  className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 pr-12 text-sm text-foreground outline-none transition hover:bg-white/[0.07]"
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
              <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="v2-focus-ring mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="font-semibold text-teal-200"
                >
                  Registrarse
                </button>
              </p>
            )}
          </form>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/40">
            Financial OS · Copilot financiero personal
          </p>
        </div>
      </div>
    </div>
  );
}
