"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Mail,
  Palette,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { useTutorial } from "@/components/app/tutorial";
import Link from "next/link";

type SettingsClientProps = {
  primaryCurrency: string;
  isAiEnabled?: boolean;
};

const faqs = [
  {
    q: "¿Cómo funciona el disponible real?",
    a: "El disponible real es tu ingreso menos los gastos ya registrados, el presupuesto reservado no gastado, y las obligaciones próximas (recurrentes, metas, deudas). Es lo que realmente podés usar sin comprometer ningún compromiso financiero.",
  },
  {
    q: "¿Qué pasa si tengo cuentas en ARS y USD?",
    a: "Meridian muestra los activos, pasivos y patrimonio separados por moneda para evitar conversiones incorrectas. No se suman ni se convierten: cada moneda se ve por separado.",
  },
  {
    q: "¿Cómo funciona Smart Import?",
    a: "Smart Import lee imágenes, PDFs o texto con movimientos bancarios y los convierte en transacciones. La IA extrae los datos y vos revisás y confirmás antes de importar.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Tus datos financieros están protegidos y nunca se comparten con terceros. La IA solo accede a información agregada (totales y categorías) para generar los análisis, nunca a detalles personales.",
  },
];

export function SettingsClient({ primaryCurrency, isAiEnabled }: SettingsClientProps) {
  const router = useRouter();
  const { start: startTutorial } = useTutorial();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteData() {
    if (deleteInput !== "ELIMINAR") return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/data", { method: "DELETE" });
      if (!response.ok) {
        toast.error("No se pudo borrar la información. Intentá de nuevo.");
        return;
      }
      toast.success("Información financiera eliminada. Empezá de cero.");
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-400">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ajustes</h1>
          <p className="text-sm text-zinc-500">Preferencias y configuración de Meridian</p>
        </div>
      </div>

      {/* ── Apariencia ── */}
      <Section icon={Palette} title="Apariencia">
        <SettingRow
          icon={Palette}
          label="Tema"
          description="Modo claro, oscuro o del sistema"
          action={
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
              Próximamente
            </span>
          }
        />
      </Section>

      {/* ── Región ── */}
      <Section icon={Globe} title="Región">
        <SettingRow
          icon={Globe}
          label="Moneda principal"
          description="Usada como referencia en el dashboard y reportes"
          action={
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300">
              {primaryCurrency}
            </span>
          }
        />
        <SettingRow
          icon={Globe}
          label="Formato regional"
          description="Números y fechas"
          action={
            <span className="text-xs text-zinc-500">Argentina</span>
          }
        />
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
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Cambiar
            </a>
          }
        />
        <SettingRow
          icon={Download}
          label="Exportar datos"
          description="Descargá un archivo con toda tu información financiera"
          action={
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
              Próximamente
            </span>
          }
        />

        {/* Privacidad */}
        <div className="px-5 py-3">
          <p className="text-xs leading-5 text-zinc-600">
            Tus datos financieros son privados y están protegidos. Meridian nunca comparte información con terceros.
            {isAiEnabled && " Las funciones IA solo acceden a totales agregados, nunca a transacciones individuales."}
          </p>
        </div>
      </Section>

      {/* ── Borrar información (card separada) ── */}
      <PremiumCard className="border-rose-500/15 bg-rose-500/[0.04]">
        <PremiumCardHeader className="border-b border-rose-500/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <PremiumCardTitle className="text-sm text-rose-200">Zona de riesgo</PremiumCardTitle>
              <p className="text-xs text-zinc-500">Las acciones de esta sección son irreversibles</p>
            </div>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent className="p-0">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-500">
                <CircleSlash className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Borrar toda la información</p>
                <p className="mt-0.5 text-xs leading-4 text-zinc-500">
                  Elimina cuentas, transacciones, presupuestos, metas, deudas, recurrentes y snapshots. Tu cuenta de acceso queda intacta.
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
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Escribir
            </a>
          }
        />

        {/* FAQ */}
        <div className="divide-y divide-white/[0.04]">
          {faqs.map((faq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-300">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
              </div>
              {openFaq === i && (
                <p className="mt-2 text-xs leading-5 text-zinc-500">{faq.a}</p>
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
              className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Ir
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      </Section>

      {/* ── Confirmación borrar datos ── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setDeleteOpen(false); setDeleteInput(""); }}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-[28px] border border-white/10 bg-zinc-950/98 p-6 shadow-2xl sm:rounded-[28px]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Borrar toda la información</h2>
                <p className="text-xs text-zinc-500">Esta acción es irreversible</p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] p-4">
              <p className="text-xs leading-5 text-zinc-300">
                Se eliminarán permanentemente todas las cuentas, transacciones, presupuestos, metas,
                deudas, recurrentes y análisis IA. <strong className="text-rose-300">No se puede deshacer.</strong>
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Tu cuenta de acceso (email y contraseña) queda intacta.
              </p>
            </div>

            <div className="mb-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Escribí <span className="font-bold text-rose-300">ELIMINAR</span> para confirmar
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
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
                onClick={handleDeleteData}
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
        <Icon className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">{title}</h2>
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
