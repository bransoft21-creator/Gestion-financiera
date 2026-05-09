import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const actionButtonVariants = cva(
  "v2-focus-ring inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-white text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] hover:bg-zinc-100",
        glass: "border border-white/10 bg-white/[0.055] text-zinc-100 hover:bg-white/[0.09]",
        quiet: "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
        danger: "border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15",
      },
      size: {
        default: "h-11",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-12 px-5",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {
  asChild?: boolean;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(actionButtonVariants({ variant, size, className }))} {...props} />;
  },
);
ActionButton.displayName = "ActionButton";

export { ActionButton, actionButtonVariants };
