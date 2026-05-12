import * as React from "react";
import { cn } from "@/lib/utils";

type PremiumCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "raised" | "quiet";
  interactive?: boolean;
};

const variants = {
  default: "v2-card rounded-[var(--v2-radius-lg)]",
  raised: "v2-card-raised rounded-[var(--v2-radius-xl)]",
  quiet: "rounded-[var(--v2-radius-lg)] border border-white/[0.08] bg-white/[0.035]",
} as const;

export function PremiumCard({
  variant = "default",
  interactive = false,
  className,
  ...props
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 text-foreground",
        variants[variant],
        interactive && "cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.055] active:scale-[0.985]",
        className,
      )}
      {...props}
    />
  );
}

export function PremiumCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-5 sm:p-6", className)} {...props} />;
}

export function PremiumCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-tight text-white", className)} {...props} />;
}

export function PremiumCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-zinc-400", className)} {...props} />;
}

export function PremiumCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
