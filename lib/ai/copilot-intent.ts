export type CopilotIntent =
  | "expenses_breakdown"
  | "income_analysis"
  | "savings_trend"
  | "budget_status"
  | "category_detail"
  | "month_comparison"
  | "recurring_expenses"
  | "goals_progress"
  | "debts_status"
  | "household_balance"
  | "optimization_advice"
  | "concerns_overview"
  | "commitments_this_month"
  | "cash_flow"
  | "explain_metric"
  | "REJECT";

const REJECT_PATTERNS = [
  /receta|cocina|lasagna|ingrediente|gastronomia/,
  /mundial|partido|futbol|basquet|deporte|olimpico/,
  /capital de|historia de|cultura general|monumento/,
  /codigo|javascript|python|programar|software|html|css|sql/,
  /bitcoin|cripto|nft|blockchain|token|ethereum/,
  /salud|medico|sintoma|enfermedad|diagnostico|remedio/,
  /pelicula|serie|netflix|musica|spotify|videojuego/,
  /clima|temperatura|pronostico del tiempo/,
  /politica|eleccion|presidente|gobierno/,
  /chiste|broma|cuento|poema/,
];

const INTENT_PATTERNS: Array<[CopilotIntent, RegExp]> = [
  ["month_comparison", /cambi[oó]|compar[oó]|vs mes|mes anterior|mes pasado|diferencia/],
  ["savings_trend", /ahorr[oé]|saving|reserv[eaé]|cuanto guard/],
  ["budget_status", /presupuest[oa]|budget|plan[eé]|limite/],
  ["recurring_expenses", /suscripci[oó]n|recurrente|fij[oa]|mensual|repite/],
  ["goals_progress", /objetivo|meta|goal|ahorro para|proyecto/],
  ["debts_status", /deuda|cr[eé]dito|pr[eé]stamo|debo|cu[oó]ta|cuotas/],
  ["household_balance", /hogar|casa|balance|compartid|conviviente|pareja/],
  ["optimization_advice", /ahorrar|reducir|optimizar|mejorar|donde puedo|bajar gasto/],
  ["concerns_overview", /preocupa|riesgo|problema|alerta|mal|peligro/],
  ["commitments_this_month", /compromiso|vencimiento|pago pendiente|debo pagar/],
  ["explain_metric", /por qu[eé]|porque|explic[aá]|raz[oó]n|motivo|c[oó]mo lleg/],
  ["income_analysis", /ingres[oé]|sueldo|salario|cobr[eé]|entr[oó]/],
  ["cash_flow", /flujo|disponible|plata|efectivo|tengo para|me sobra|me falta/],
  ["category_detail", /delivery|super|farmacia|transporte|categoria|gasteo en|cuanto en/],
  ["expenses_breakdown", /gast[eé]|gast[oó]|spend|en qu[eé]|mayor gasto|mas gaste|mas caro/],
];

export function classifyIntent(message: string): {
  intent: CopilotIntent;
  confidence: "high" | "medium";
} {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (REJECT_PATTERNS.some((p) => p.test(normalized))) {
    return { intent: "REJECT", confidence: "high" };
  }

  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { intent, confidence: "high" };
    }
  }

  // Mensaje corto sin palabras financieras → REJECT
  if (normalized.length < 10) {
    return { intent: "REJECT", confidence: "medium" };
  }

  // Default: parece financiero pero no clasificado específicamente
  return { intent: "expenses_breakdown", confidence: "medium" };
}
