import { cn } from "@/lib/utils";

type CopilotSummaryOrbProps = {
  score: number;
  label?: string;
  className?: string;
};

export function CopilotSummaryOrb({ score, label = "Copilot score", className }: CopilotSummaryOrbProps) {
  const normalizedScore = Math.min(Math.max(Math.round(score), 0), 100);
  const color = normalizedScore >= 78
    ? "rgba(110,231,183,0.92)"
    : normalizedScore >= 58
      ? "rgba(125,211,252,0.92)"
      : normalizedScore >= 42
        ? "rgba(253,230,138,0.92)"
        : "rgba(253,164,175,0.92)";

  return (
    <div className={cn("relative flex aspect-square w-full max-w-[13rem] items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-4", className)}>
      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: `conic-gradient(${color} ${normalizedScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      />
      <div className="absolute inset-8 rounded-full bg-zinc-950/95 shadow-inner" />
      <div className="relative z-10 text-center">
        <p className="text-[11px] font-semibold uppercase text-zinc-500">{label}</p>
        <p className="mt-2 text-5xl font-semibold tabular-nums text-white">{normalizedScore}</p>
        <p className="mt-1 text-xs text-zinc-500">sobre 100</p>
      </div>
    </div>
  );
}
