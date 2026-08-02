-- Historial de mensajes del copilot de IA por household.
-- Un mensaje por turno (role: "user" | "assistant").

CREATE TABLE "AiCopilotMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "contextHash" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCopilotMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCopilotMessage_userId_createdAt_idx" ON "AiCopilotMessage"("userId", "createdAt");
CREATE INDEX "AiCopilotMessage_householdId_createdAt_idx" ON "AiCopilotMessage"("householdId", "createdAt");

ALTER TABLE "AiCopilotMessage" ADD CONSTRAINT "AiCopilotMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiCopilotMessage" ADD CONSTRAINT "AiCopilotMessage_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
