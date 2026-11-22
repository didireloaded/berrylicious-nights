import { Check, CheckCircle2, ChefHat, Clock3, PackageCheck, Star, Utensils } from "lucide-react";
import type { OrderFulfillmentType } from "@/lib/orderLifecycle";
import { cn } from "@/lib/utils";

export interface TimelineStepInput {
  key: "pending" | "confirmed" | "preparing" | "ready" | "handover" | "completed";
  label: string;
  description: string;
  timestamp?: string;
}

export interface OrderProgressTimelineProps {
  currentStatus: string;
  orderType?: OrderFulfillmentType;
  timestampsByStatus?: Map<string, string>;
  hasGenuineHandover?: boolean;
}

const STAGE_ORDER = ["pending", "confirmed", "preparing", "ready", "handover", "completed"] as const;

function iconForStage(key: TimelineStepInput["key"]) {
  switch (key) {
    case "pending":
      return Clock3;
    case "confirmed":
      return CheckCircle2;
    case "preparing":
      return ChefHat;
    case "ready":
      return PackageCheck;
    case "handover":
      return Utensils;
    case "completed":
      return Star;
  }
}

/**
 * Clean vertical progress timeline for Butcher Block orders.
 * - Uses "Ready for collection" for pickup/pre-order (never implying delivery).
 * - Shows "On the way to your table" only for dine-in orders when a genuine
 *   handover stage is present.
 */
export function OrderProgressTimeline({
  currentStatus,
  orderType,
  timestampsByStatus,
  hasGenuineHandover = false,
}: OrderProgressTimelineProps) {
  const isDineIn = orderType === "dinein";
  const showHandoverStage =
    isDineIn && (currentStatus === "handover" || hasGenuineHandover);

  const steps: TimelineStepInput[] = [
    {
      key: "pending",
      label: "Order received",
      description: "Your order has been received by Butcher Block.",
      timestamp: timestampsByStatus?.get("pending"),
    },
    {
      key: "confirmed",
      label: "Kitchen confirmed",
      description: "The kitchen has accepted your ticket.",
      timestamp: timestampsByStatus?.get("confirmed"),
    },
    {
      key: "preparing",
      label: "Preparing",
      description: "Our grill and kitchen team are preparing your meal.",
      timestamp: timestampsByStatus?.get("preparing"),
    },
    {
      key: "ready",
      label: isDineIn ? "Ready" : "Ready for collection",
      description: isDineIn
        ? "Your dishes are plated and ready for table service."
        : "Your order is ready for collection at Butcher Block.",
      timestamp: timestampsByStatus?.get("ready"),
    },
    ...(showHandoverStage
      ? [
          {
            key: "handover" as const,
            label: "On the way to your table",
            description: "Your server is bringing your order to your table.",
            timestamp: timestampsByStatus?.get("handover"),
          },
        ]
      : []),
    {
      key: "completed",
      label: "Completed",
      description: isDineIn ? "Served at your table. Enjoy your meal." : "Collected. Enjoy your meal.",
      timestamp: timestampsByStatus?.get("completed"),
    },
  ];

  const rawRank = STAGE_ORDER.indexOf(currentStatus as (typeof STAGE_ORDER)[number]);
  const currentRank = rawRank >= 0 ? rawRank : 0;

  return (
    <ol className="mt-5 space-y-0" aria-label="Order progress">
      {steps.map((step, index) => {
        const stepRank = STAGE_ORDER.indexOf(step.key);
        const isCurrent = step.key === currentStatus || (!showHandoverStage && currentStatus === "handover" && step.key === "ready");
        const isDone = !isCurrent && stepRank < currentRank;
        const isLast = index === steps.length - 1;
        const Icon = iconForStage(step.key);

        return (
          <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
            {/* Vertical rail */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[17px] top-9 bottom-1 w-[2px] rounded-full transition-colors",
                  isDone ? "bg-[#FF5A1F]/45" : "bg-white/10",
                )}
              />
            )}

            {/* Node indicator */}
            <span
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                isCurrent
                  ? "border-[#FF5A1F] bg-[#FF5A1F] text-white shadow-[0_0_0_4px_rgba(255,90,31,0.18)]"
                  : isDone
                    ? "border-[#FF5A1F]/40 bg-[#FF5A1F]/15 text-[#FF5A1F]"
                    : "border-white/10 bg-[#1B1B1B] text-[#737373]",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isDone ? (
                <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
            </span>

            {/* Stage copy */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "text-[15px] font-bold leading-snug",
                    isCurrent ? "text-white" : isDone ? "text-white/90" : "text-[#737373]",
                  )}
                >
                  {step.label}
                </p>
                {step.timestamp && (isDone || isCurrent) && (
                  <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#A3A3A3]">
                    {step.timestamp}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[14px] leading-relaxed",
                  isCurrent ? "text-[#D4D4D4]" : isDone ? "text-[#A3A3A3]" : "text-[#737373]",
                )}
              >
                {step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
