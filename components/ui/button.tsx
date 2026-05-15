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
          "bg-foreground text-background shadow-[var(--btn-default-shadow)] hover:opacity-90",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-muted",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted",
        destructive:
          "border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
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
