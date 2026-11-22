import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH } from "@/lib/authUtils";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  error?: string | null;
  showRequirement?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { id, label, error, showRequirement = false, value, className, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const stringVal = typeof value === "string" ? value : "";
    const meetsLength = stringVal.length >= MIN_PASSWORD_LENGTH;

    const errorId = error ? `${id}-error` : undefined;
    const reqId = showRequirement ? `${id}-req` : undefined;
    const describedBy = [errorId, reqId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-[14px] font-semibold text-white/90">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            className={cn(
              "min-h-[52px] w-full rounded-2xl border bg-[#242424] pl-4 pr-13 text-[16px] text-white placeholder:text-[#737373] transition-[border-color,background-color,box-shadow] duration-200 focus:outline-none focus:ring-2",
              error
                ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/25"
                : "border-white/10 focus:border-[#FF5A1F] focus:ring-[#FF5A1F]/25",
              "disabled:opacity-55",
              className,
            )}
            style={{ paddingRight: "3.25rem" }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
            className="bb-press absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            {visible ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>

        {showRequirement && (
          <p
            id={reqId}
            className={cn(
              "flex items-center gap-1.5 text-[13px] transition-colors",
              stringVal.length === 0
                ? "text-[#A3A3A3]"
                : meetsLength
                  ? "text-emerald-400"
                  : "text-[#A3A3A3]",
            )}
          >
            <Check
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-opacity",
                meetsLength ? "opacity-100 text-emerald-400" : "opacity-40",
              )}
              aria-hidden="true"
            />
            At least {MIN_PASSWORD_LENGTH} characters
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-[13px] font-medium text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);
