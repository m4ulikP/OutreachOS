import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, label, id, options, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-foreground tracking-tight"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? "true" : undefined}
            className={cn(
              "flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs text-foreground shadow-2xs transition-colors appearance-none pr-8",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-surface",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-danger focus-visible:ring-danger",
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-surface text-foreground">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-foreground-muted">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p className="text-[11px] text-danger mt-1 font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
