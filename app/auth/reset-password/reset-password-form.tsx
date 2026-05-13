"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { MeridianMark } from "@/components/brand/meridian-mark";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

type FieldErrors = {
  password?: string;
  confirmPassword?: string;
};

const INVALID_LINK_MESSAGE = "El enlace expiró o no es válido";

function getRedirectPath() {
  return "/login";
}

export function ResetPasswordForm() {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let isMounted = true;

    async function establishRecoverySession() {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = query.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const recoveryType = query.get("type") ?? hash.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            if (isMounted) setRecoveryState("invalid");
            return;
          }

          window.history.replaceState({}, document.title, url.pathname);
          if (isMounted) setRecoveryState("ready");
          return;
        }

        if (accessToken && refreshToken && recoveryType === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            if (isMounted) setRecoveryState("invalid");
            return;
          }

          window.history.replaceState({}, document.title, url.pathname);
          if (isMounted) setRecoveryState("ready");
          return;
        }

        if (isMounted) setRecoveryState("invalid");
      } catch {
        if (isMounted) setRecoveryState("invalid");
      }
    }

    establishRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const password = ((formData.get("password") as string) ?? "").trim();
    const confirmPassword = ((formData.get("confirmPassword") as string) ?? "").trim();

    const errors: FieldErrors = {};
    if (!password) errors.password = "Ingresá una contraseña nueva.";
    else if (password.length < 8) errors.password = "Mínimo 8 caracteres.";
    if (!confirmPassword) errors.confirmPassword = "Confirmá la contraseña.";
    else if (password !== confirmPassword) errors.confirmPassword = "Las contraseñas no coinciden.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage("No pudimos actualizar la contraseña. Pedí un nuevo enlace e intentá otra vez.");
        setIsSubmitting(false);
        return;
      }

      setRecoveryState("success");
      setMessage(null);
      await supabase.auth.signOut();

      window.setTimeout(() => {
        window.location.href = getRedirectPath();
      }, 1800);
    } catch {
      setMessage("No pudimos actualizar la contraseña. Intentá de nuevo en un momento.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <section className="fade-in w-full max-w-[460px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <MeridianMark
            size={24}
            showContainer
            containerSize={56}
            containerClassName="mb-4 rounded-[24px] shadow-[0_18px_55px_rgba(45,212,191,0.12)]"
          />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-100/80">Meridian</p>
        </div>

        <div className="v2-card-raised rounded-[28px] p-6 sm:p-8">
          {recoveryState === "checking" && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Loader2 className="mb-4 h-7 w-7 animate-spin text-teal-100" aria-hidden="true" />
              <h1 className="text-2xl font-semibold text-foreground">Validando enlace</h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Estamos preparando el cambio de contraseña.
              </p>
            </div>
          )}

          {recoveryState === "invalid" && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-rose-300/20 bg-rose-400/10 text-rose-100">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">{INVALID_LINK_MESSAGE}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Volvé al login y solicitá un nuevo correo para cambiar tu contraseña.
              </p>
              <a
                href="/login"
                className="v2-focus-ring mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] transition hover:bg-zinc-100"
              >
                Ir al login
              </a>
            </div>
          )}

          {recoveryState === "success" && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">Contraseña actualizada</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Ya podés iniciar sesión con tu nueva contraseña.
              </p>
            </div>
          )}

          {recoveryState === "ready" && (
            <>
              <div className="mb-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-teal-100">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground">Creá una nueva contraseña</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Elegí una clave segura para recuperar el acceso a tu cuenta.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 pr-12 text-sm text-foreground outline-none transition hover:bg-white/[0.07]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.password}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="v2-focus-ring h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 pr-12 text-sm text-foreground outline-none transition hover:bg-white/[0.07]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
                </div>

                {message && (
                  <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="v2-focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
