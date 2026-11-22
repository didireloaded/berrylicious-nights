import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface AuthTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
}

export const AuthTextField = forwardRef<HTMLInputElement, AuthTextFieldProps>(
  function AuthTextField({ id, label, error, hint, className, ...props }, ref) {
    const errorId = error ? `${id}-error` : undefined;
    const hintId = !error && hint ? `${id}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-[14px] font-semibold text-white/90">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "min-h-[52px] w-full rounded-2xl border bg-[#242424] px-4 text-[16px] text-white placeholder:text-[#737373] transition-[border-color,background-color,box-shadow] duration-200 focus:outline-none focus:ring-2",
            error
              ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/25"
              : "border-white/10 focus:border-[#FF5A1F] focus:ring-[#FF5A1F]/25",
            "disabled:opacity-55",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-[13px] font-medium text-red-400">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[13px] text-[#A3A3A3]">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
