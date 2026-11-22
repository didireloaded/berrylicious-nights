import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthErrorMessageProps {
  message: string | null | undefined;
  variant?: "error" | "success" | "info";
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function AuthErrorMessage({
  message,
  variant = "error",
  actionLabel,
  onAction,
  className,
}: AuthErrorMessageProps) {
  if (!message) return null;

  const isError = variant === "error";
  const isSuccess = variant === "success";

  const Icon = isError ? AlertCircle : isSuccess ? CheckCircle2 : Info;

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "animate-fade-in flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-[14px] leading-snug",
        isError && "border-red-500/35 bg-red-500/10 text-red-200",
        isSuccess && "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
        !isError && !isSuccess && "border-white/15 bg-[#242424] text-[#D4D4D4]",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          isError && "text-red-400",
          isSuccess && "text-emerald-400",
          !isError && !isSuccess && "text-[#FF5A1F]",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <p>{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-[36px] items-center rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
