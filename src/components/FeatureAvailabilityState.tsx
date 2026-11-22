import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Clock3,
  Inbox,
  Lock,
  QrCode,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import { cn } from "@/lib/utils";

export interface FeatureAvailabilityAction {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export interface FeatureAvailabilityStateProps {
  status: Exclude<FeatureAvailabilityStatus, "available">;
  title: string;
  description: string;
  primaryAction?: FeatureAvailabilityAction;
  secondaryAction?: FeatureAvailabilityAction;
  compact?: boolean;
  icon?: ReactNode;
  className?: string;
}

function defaultIcon(status: Exclude<FeatureAvailabilityStatus, "available">) {
  switch (status) {
    case "loading":
      return (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF5A1F] border-t-transparent"
          aria-hidden="true"
        />
      );
    case "requires_sign_in":
      return <Lock className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />;
    case "requires_table_session":
      return <QrCode className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />;
    case "coming_soon":
      return <Sparkles className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />;
    case "temporarily_unavailable":
      return <WifiOff className="h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />;
    case "empty":
    default:
      return <Inbox className="h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />;
  }
}

function renderAction(action: FeatureAvailabilityAction) {
  const isPrimary = action.variant !== "secondary";
  const classes = cn(
    "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[14px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]",
    isPrimary
      ? "bg-[#FF5A1F] text-white hover:bg-[#E84D15]"
      : "border border-white/15 bg-[#303030] text-white hover:bg-[#3A3A3A]",
  );

  if (action.to) {
    return (
      <Link to={action.to} className={classes}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={classes}>
      {action.label}
    </button>
  );
}

export function FeatureAvailabilityState({
  status,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  icon,
  className,
}: FeatureAvailabilityStateProps) {
  const badgeText =
    status === "coming_soon"
      ? "Coming soon"
      : status === "temporarily_unavailable"
        ? "Unavailable"
        : status === "requires_table_session"
          ? "Table session required"
          : status === "requires_sign_in"
            ? "Sign in required"
            : null;

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[22px] border border-white/10 bg-[#242424] text-left",
        compact ? "p-4" : "p-5",
        status === "error" && "border-red-500/35 bg-red-950/20",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#181818] border border-white/10">
          {icon ?? defaultIcon(status)}
        </span>
        <div className="min-w-0 flex-1">
          {badgeText && (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#303030] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A3A3A3]">
              <Clock3 className="h-3 w-3 text-[#FF5A1F]" aria-hidden="true" />
              {badgeText}
            </span>
          )}
          <h3 className="text-[16px] font-bold leading-snug text-white">{title}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-[#A3A3A3]">{description}</p>

          {(primaryAction || secondaryAction) && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {primaryAction && renderAction(primaryAction)}
              {secondaryAction && renderAction({ ...secondaryAction, variant: "secondary" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
