"use client";

import { useEffect, useRef, useState } from "react";
import { Send, BotMessageSquare, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  dataUsed?: string;
  periodAnalyzed?: string;
  hasEnoughData?: boolean;
  suggestedFollowUps?: string[];
};

const SUGGESTED_QUESTIONS = [
  "¿En qué gasté más este mes?",
  "¿Qué cambió respecto al mes pasado?",
  "¿Cómo viene mi ahorro?",
  "¿Qué me debería preocupar?",
  "¿Dónde puedo reducir gastos?",
  "¿Qué compromisos tengo este mes?",
];

export function CopilotClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Hubo un error. Intentá nuevamente.");
        setLoading(false);
        return;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.data.answer,
        dataUsed: data.data.dataUsed,
        periodAnalyzed: data.data.periodAnalyzed,
        hasEnoughData: data.data.hasEnoughData,
        suggestedFollowUps: data.data.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("No se pudo conectar con el copiloto. Verificá tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-120px)] flex-col lg:h-[calc(100dvh-68px)]">
      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <PageHeader
          title="Copiloto Financiero"
          description="Hacé preguntas sobre tus finanzas. Respondo usando únicamente tus datos de Meridian."
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 lg:px-6">
        {isEmpty ? (
          <EmptyState onSelect={sendMessage} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-4 pb-4">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} content={msg.content} />
              ) : (
                <AssistantBubble
                  key={msg.id}
                  message={msg}
                  onFollowUp={sendMessage}
                />
              ),
            )}
            {loading && <ThinkingBubble />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error ? (
        <div className="mx-4 mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive lg:mx-6">
          {error}
        </div>
      ) : null}

      {/* Input */}
      <InputArea
        inputRef={inputRef}
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={() => sendMessage(input)}
        loading={loading}
      />
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <BotMessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Copiloto listo</p>
          <p className="text-xs text-muted-foreground">
            Analizando tus datos financieros de este mes
          </p>
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
        Preguntas sugeridas
      </p>
      <div className="grid gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3 text-left text-sm font-medium text-foreground transition-all duration-150 hover:bg-muted/60 hover:border-border/80 active:scale-[0.99]"
          >
            <span>{q}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onFollowUp,
}: {
  message: Message;
  onFollowUp: (q: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[90%] rounded-2xl rounded-tl-md border border-border bg-muted/40 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {message.content}
        </p>
        {message.periodAnalyzed || message.dataUsed ? (
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground/70 border-t border-border/50 pt-2">
            {[message.periodAnalyzed, message.dataUsed].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 ? (
        <div className="ml-1 flex flex-wrap gap-2">
          {message.suggestedFollowUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <BotMessageSquare className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Analizando tus datos...</span>
        </div>
      </div>
    </div>
  );
}

function InputArea({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  loading,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  loading: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-background/80 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl lg:px-6">
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Hacé tu pregunta financiera..."
          rows={1}
          disabled={loading}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
            "max-h-32 min-h-[24px]",
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !value.trim()}
          className={cn(
            "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150",
            value.trim() && !loading
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted text-muted-foreground",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
        Solo respondo preguntas financieras sobre tus datos de Meridian
      </p>
    </div>
  );
}
