export function isAiEnabled(email: string): boolean {
  if (isDisabled("AI")) return false;
  return isInBetaAllowlist(email);
}

export function isSmartImportEnabled(email: string): boolean {
  if (isDisabled("SMART_IMPORT")) return false;
  return isAiEnabled(email);
}

export function isCopilotEnabled(email: string): boolean {
  if (isDisabled("COPILOT")) return false;
  const whitelist = parseList(process.env.COPILOT_ALLOWLIST_EMAILS);
  if (whitelist.length > 0) return whitelist.includes(email.toLowerCase());
  return isAiEnabled(email);
}

export function isMaintenanceModeEnabled(): boolean {
  return process.env.MAINTENANCE_MODE === "1";
}

function isDisabled(flag: "AI" | "SMART_IMPORT" | "COPILOT") {
  return process.env[`DISABLE_${flag}`] === "1";
}

function isInBetaAllowlist(email: string) {
  const allowlist = parseList(process.env.BETA_ALLOWLIST_EMAILS);
  if (allowlist.length === 0) return true;
  return allowlist.includes(email.toLowerCase());
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export type AiAccessStatus = {
  enabled: boolean;
  badge: string;
  description: string;
};

export function getAiAccessStatus(email: string): AiAccessStatus {
  const enabled = isAiEnabled(email);
  if (enabled) {
    return {
      enabled: true,
      badge: "IA habilitada",
      description:
        "Tenés acceso al análisis mensual con IA y Smart Import. El sistema lee tus patrones y genera contexto financiero en tiempo real.",
    };
  }
  return {
    enabled: false,
    badge: "IA no disponible",
    description: "Las funciones de IA están disponibles para usuarios beta. Tu cuenta está en lista de espera.",
  };
}
