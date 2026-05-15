import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "v2-focus-ring flex h-11 w-full min-w-0 max-w-full rounded-2xl border border-border bg-input px-4 py-2 text-base md:text-sm text-foreground outline-none",
        "transition-[border-color,box-shadow] duration-200 hover:border-muted-foreground/30",
        "placeholder:text-muted-foreground/55",
        "disabled:cursor-not-allowed disabled:opacity-50",
        type === "date" && "block appearance-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
