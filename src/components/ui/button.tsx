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
          "inline-flex items-center justify-center font-medium transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          // Variants
          variant === "primary" &&
            "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
          variant === "secondary" &&
            "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
          variant === "outline" &&
            "border border-border bg-transparent hover:bg-secondary text-foreground",
          variant === "ghost" &&
            "hover:bg-secondary text-foreground",
          variant === "destructive" &&
            "bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm",
          // Sizes
          size === "sm" && "h-8 px-3 text-xs rounded-md gap-1.5",
          size === "md" && "h-9 px-4 text-sm rounded-md gap-2",
          size === "lg" && "h-11 px-6 text-base rounded-lg gap-2.5",
          size === "icon" && "h-9 w-9 p-0 rounded-md",
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
