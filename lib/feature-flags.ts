export function isAiEnabled(_email: string): boolean {
  return true;
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
