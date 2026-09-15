import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-foreground tracking-tight"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs text-foreground shadow-2xs transition-colors",
            "file:border-0 file:bg-transparent file:text-xs file:font-medium",
            "placeholder:text-foreground-muted",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-surface",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus-visible:ring-danger",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-[11px] font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
