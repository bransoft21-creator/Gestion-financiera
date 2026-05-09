"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AiFinancialAnalysis = {
  summary: string;
  score: number;
  positivePoints: Array<{ title: string; message: string }>;
  alerts: Array<{ severity: "low" | "medium" | "high"; title: string; message: string }>;
  recommendations: Array<{ title: string; message: string; estimatedImpact: string }>;
  riskPoints: Array<{ title: string; message: string }>;
};

type ApiResponse = {
  data?: {
    analysis: AiFinancialAnalysis;
    cached: boolean;
    month: string;
    generatedAt: string;
  };
  error?: string;
};

const severityStyles = {
  low: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  medium: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  high: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

const severityLabels = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function FinancialAiAnalysisCard({ month }: { month: string }) {
  const [analysis, setAnalysis] = useState<AiFinancialAnalysis | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/monthly-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "No se pudo generar el análisis.");
        return;
      }

      setAnalysis(payload.data.analysis);
      setIsCached(payload.data.cached);
    } catch {
      setError("Error de red. Intentá nuevamente en unos segundos.");
    } finally {
      setIsLoading(false);
    }
  }

  const score = analysis?.score ?? 0;
  const scoreTone = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Brain className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Análisis inteligente del mes</CardTitle>
              <CardDescription className="mt-0.5">Lectura compacta de tus ingresos, gastos y señales.</CardDescription>
            </div>
          </div>
        </div>
        <Button onClick={handleAnalyze} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {analysis ? "Actualizar análisis" : "Analizar con IA"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <p className="text-sm leading-5 text-rose-100">{error}</p>
          </div>
        )}

        {!analysis && !error && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Generá una lectura mensual con alertas, recomendaciones y riesgos detectados sin enviar tus transacciones completas a la IA.
            </p>
          </div>
        )}

        {analysis && (
          <>
            <div className="grid gap-3 md:grid-cols-[140px_1fr]">
              <div className="rounded-lg border border-border bg-background/35 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score financiero</p>
                <p className={`mt-2 text-4xl font-extrabold tabular-nums ${scoreTone}`}>{Math.round(score)}</p>
                <p className="text-xs text-muted-foreground">/ 100</p>
              </div>
              <div className="rounded-lg border border-border bg-background/35 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-violet-500/25 bg-violet-500/10 text-violet-200">IA</Badge>
                  {isCached && <Badge>Guardado</Badge>}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              </div>
            </div>

            <Section title="Alertas" icon={AlertTriangle}>
              {analysis.alerts.map((item) => (
                <div key={`${item.severity}-${item.title}`} className="rounded-lg border border-border p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge className={severityStyles[item.severity]}>{severityLabels[item.severity]}</Badge>
                    <h4 className="text-sm font-semibold">{item.title}</h4>
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">{item.message}</p>
                </div>
              ))}
            </Section>

            <Section title="Recomendaciones" icon={Target}>
              {analysis.recommendations.map((item) => (
                <div key={item.title} className="rounded-lg border border-border p-3">
                  <h4 className="text-sm font-semibold">{item.title}</h4>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.message}</p>
                  <p className="mt-2 text-xs font-medium text-emerald-300">{item.estimatedImpact}</p>
                </div>
              ))}
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Puntos positivos" icon={CheckCircle2}>
                {analysis.positivePoints.map((item) => (
                  <SmallItem key={item.title} title={item.title} message={item.message} icon={BadgeCheck} />
                ))}
              </Section>

              <Section title="Riesgos" icon={ShieldAlert}>
                {analysis.riskPoints.map((item) => (
                  <SmallItem key={item.title} title={item.title} message={item.message} icon={ShieldAlert} />
                ))}
              </Section>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-300" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function SmallItem({
  title,
  message,
  icon: Icon,
}: {
  title: string;
  message: string;
  icon: typeof BadgeCheck;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
