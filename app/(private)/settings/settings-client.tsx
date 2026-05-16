"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Download,
  FolderTree,
  Globe,
  HelpCircle,
  KeyRound,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Palette,
  ScanLine,
  Settings,
  Sun,
  TriangleAlert,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { usePreferences } from "@/components/app/preferences-provider";
import { useTutorial } from "@/components/app/tutorial";
import Link from "next/link";

type Preferences = {
  theme: "system" | "dark" | "light";
  textSize: "normal" | "large";
  language: "es" | "en";
  primaryCurrency: "ARS" | "USD";
  onboardingGoals: string[];
};

type SettingsClientProps = {
  preferences: Preferences;
};

const faqs = [
  {
    q: "¿Cómo funciona el disponible real?",
    a: "Es tu ingreso menos los gastos registrados, el presupuesto reservado no gastado y las obligaciones próximas (recurrentes, metas, deudas). Lo que podés usar sin comprometer ningún compromiso.",
  },
  {
    q: "¿Qué pasa si tengo cuentas en ARS y USD?",
    a: "Meridian muestra activos, pasivos y patrimonio separados por moneda para evitar conversiones incorrectas. Cada moneda se ve por separado.",
  },
  {
    q: "¿Cómo funciona Smart Import?",
    a: "Lee imágenes, PDFs o texto con movimientos bancarios y los convierte en transacciones. La IA extrae los datos y vos revisás antes de importar.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Tus datos financieros son privados y nunca se comparten con terceros. La IA solo accede a totales agregados, nunca a detalles personales.",
  },
];

export function SettingsClient({ preferences: initialPrefs }: SettingsClientProps) {
  const router = useRouter();
  const { start: startTutorial } = useTutorial();
  const { updatePreference } = usePreferences();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(initialPrefs);

  async function savePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    await updatePreference(key, value);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await fetch("/api/user/export");
      if (!response.ok) {
        toast.error("No se pudo generar el export. Intentá de nuevo.");
        return;
      }
      const blob = await response.blob();
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meridian-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datos exportados correctamente.");
    } catch {
      toast.error("Error de red. Verificá tu conexión.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteData() {
    if (deleteInput !== "ELIMINAR") return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/data", { method: "DELETE" });
      if (!response.ok) {
        toast.error("No se pudo borrar la información. Intentá de nuevo.");
        return;
      }
      toast.success("Información financiera eliminada.");
      setDeleteOpen(false);
      setDeleteInput("");
      router.push("/dashboard");
    } catch {
      toast.error("Error de red. Verificá tu conexión.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ajustes</h1>
          <p className="text-sm text-muted-foreground">Preferencias y configuración de Meridian</p>
        </div>
      </div>

      {/* ── Apariencia ── */}
      <Section icon={Palette} title="Apariencia">
        {/* Tema */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
              <Palette className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tema</p>
              <p className="text-xs text-muted-foreground">Apariencia visual de la interfaz</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "system", label: "Sistema", icon: Monitor },
              { value: "dark", label: "Oscuro", icon: Moon },
              { value: "light", label: "Claro", icon: Sun },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => void savePreference("theme", value)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-medium transition-all ${
                  prefs.theme === value
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tamaño de texto */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
              <Type className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tamaño de texto</p>
              <p className="text-xs text-muted-foreground">Ajustá la legibilidad del contenido</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "normal", label: "Normal" },
              { value: "large", label: "Grande" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => void savePreference("textSize", value)}
                className={`flex items-center justify-center rounded-2xl border px-3 py-3 text-sm font-medium transition-all ${
                  prefs.textSize === value
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-muted-foreground"
                } ${value === "large" ? "text-base" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Región ── */}
      <Section icon={Globe} title="Región">
        {/* Moneda principal */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Moneda principal</p>
              <p className="text-xs text-muted-foreground">Default en formularios y orden visual de monedas</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["ARS", "USD"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => void savePreference("primaryCurrency", currency)}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all ${
                  prefs.primaryCurrency === currency
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-muted-foreground"
                }`}
              >
                {currency === "ARS" ? "🇦🇷" : "🇺🇸"} {currency}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            No convierte monedas ni suma ARS + USD. Solo define el default en los formularios.
          </p>
        </div>

        {/* Formato */}
        <SettingRow
          icon={Globe}
          label="Formato regional"
          description="Números y fechas"
          action={<span className="text-xs text-muted-foreground">Argentina</span>}
        />
      </Section>

      {/* ── Idioma ── */}
      <Section icon={Globe} title="Idioma">
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Idioma de la app</p>
              <p className="text-xs text-muted-foreground">La preferencia se guarda para cuando llegue la traducción completa</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => void savePreference("language", value)}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-medium transition-all ${
                  prefs.language === value
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-muted-foreground"
                }`}
              >
                {label}
                {value === "en" && (
                  <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    Próximamente
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Datos y privacidad ── */}
      <Section icon={KeyRound} title="Datos y privacidad">
        <SettingRow
          icon={KeyRound}
          label="Contraseña"
          description="Cambiala si sospechás acceso no autorizado"
          action={
            <a
              href="/login"
              className="shrink-0 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Cambiar
            </a>
          }
        />
        <SettingRow
          icon={Download}
          label="Exportar datos"
          description="Descargá un JSON con todas tus cuentas, movimientos, metas y más"
          action={
            <ActionButton
              variant="glass"
              size="sm"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isExporting ? "Generando…" : "Exportar"}
            </ActionButton>
          }
        />
        <div className="px-5 py-3">
          <p className="text-xs leading-5 text-muted-foreground">
            Tus datos financieros son privados y nunca se comparten con terceros. El export no incluye contraseñas, tokens ni datos de otros usuarios.
          </p>
        </div>
      </Section>

      {/* ── Zona de riesgo ── */}
      <PremiumCard className="border-rose-500/15 bg-rose-500/[0.04]">
        <PremiumCardHeader className="border-b border-rose-500/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <PremiumCardTitle className="text-sm text-rose-200">Zona de riesgo</PremiumCardTitle>
              <p className="text-xs text-muted-foreground">Las acciones de esta sección son irreversibles</p>
            </div>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent className="p-0">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
                <CircleSlash className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Borrar toda la información</p>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  Elimina cuentas, transacciones, presupuestos, metas, deudas y recurrentes. Tu cuenta de acceso queda intacta.
                </p>
              </div>
            </div>
            <ActionButton
              type="button"
              variant="danger"
              size="sm"
              className="shrink-0"
              onClick={() => { setDeleteOpen(true); setDeleteInput(""); }}
            >
              Borrar
            </ActionButton>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      {/* ── Ayuda ── */}
      <Section icon={HelpCircle} title="Ayuda">
        <SettingRow
          icon={BookOpen}
          label="Tutorial"
          description="Repasá las funciones principales de Meridian"
          action={
            <ActionButton variant="glass" size="sm" onClick={startTutorial}>
              Ver tutorial
            </ActionButton>
          }
        />
        <SettingRow
          icon={Mail}
          label="Contacto y opinión"
          description="Envianos tu feedback o reportá un problema"
          action={
            <a
              href="mailto:bransoft21@gmail.com?subject=Meridian%20feedback"
              className="shrink-0 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Escribir
            </a>
          }
        />
        <div className="divide-y divide-white/[0.04]">
          {faqs.map((faq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full px-5 py-4 text-left transition hover:bg-muted/20"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">{faq.q}</span>
                {openFaq === i
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                }
              </div>
              {openFaq === i && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{faq.a}</p>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Organización ── */}
      <Section icon={FolderTree} title="Organización">
        <SettingRow
          icon={FolderTree}
          label="Categorías"
          description="Administrá y organizá tus categorías de gastos e ingresos"
          action={
            <Link
              href="/categories"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Ir
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <SettingRow
          icon={ScanLine}
          label="Revisar movimientos"
          description="Detectá sin categoría, categorías similares y datos que afectan reportes"
          action={
            <Link
              href="/settings/data-quality"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Ir
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      </Section>

      {/* ── Dialog: Borrar datos ── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setDeleteOpen(false); setDeleteInput(""); }}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-[28px] border border-border bg-card/98 p-6 shadow-2xl sm:rounded-[28px]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Borrar toda la información</h2>
                <p className="text-xs text-muted-foreground">Esta acción es irreversible</p>
              </div>
            </div>
            <div className="mb-5 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] p-4">
              <p className="text-xs leading-5 text-muted-foreground">
                Se eliminarán permanentemente todas las cuentas, transacciones, presupuestos, metas, deudas, recurrentes y análisis IA.{" "}
                <strong className="text-rose-300">No se puede deshacer.</strong>
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Tu cuenta de acceso (email y contraseña) queda intacta.
              </p>
            </div>
            <div className="mb-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Escribí <span className="font-bold text-rose-300">ELIMINAR</span> para confirmar
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3">
              <ActionButton
                type="button"
                variant="glass"
                className="flex-1"
                onClick={() => { setDeleteOpen(false); setDeleteInput(""); }}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                className="flex-1"
                disabled={deleteInput !== "ELIMINAR" || isDeleting}
                onClick={() => void handleDeleteData()}
              >
                {isDeleting ? "Borrando…" : "Confirmar borrado"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      <PremiumCard>
        <PremiumCardContent className="divide-y divide-white/[0.06] p-0">
          {children}
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
