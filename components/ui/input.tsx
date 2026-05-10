import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "v2-focus-ring flex h-11 w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white outline-none",
        "transition-[background-color,border-color,box-shadow] duration-200 hover:bg-white/[0.07]",
        "placeholder:text-zinc-600",
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
