import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all select-none duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          // Variants
          variant === "primary" &&
            "bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs font-semibold",
          variant === "secondary" &&
            "bg-surface-elevated text-foreground hover:bg-surface border border-border shadow-2xs",
          variant === "outline" &&
            "border border-border bg-transparent hover:bg-surface-elevated text-foreground",
          variant === "ghost" &&
            "hover:bg-surface-elevated text-foreground hover:text-foreground",
          variant === "destructive" &&
            "bg-danger text-white hover:opacity-90 shadow-xs",
          // Sizes
          size === "sm" && "h-8 px-3 text-xs rounded-md gap-1.5",
          size === "md" && "h-9 px-3.5 text-xs rounded-md gap-2",
          size === "lg" && "h-10 px-5 text-sm rounded-lg gap-2.5",
          size === "icon" && "h-8 w-8 p-0 rounded-md",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
