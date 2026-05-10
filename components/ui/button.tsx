import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "v2-focus-ring inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-white text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] hover:bg-zinc-100",
        secondary:
          "border border-white/10 bg-white/[0.055] text-zinc-100 hover:bg-white/[0.09]",
        ghost:
          "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
        outline:
          "border border-white/10 bg-white/[0.035] text-zinc-100 hover:bg-white/[0.075]",
        destructive:
          "border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15",
      },
      size: {
        default: "h-11",
        sm: "h-9 min-h-9 rounded-xl px-3 text-xs",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
