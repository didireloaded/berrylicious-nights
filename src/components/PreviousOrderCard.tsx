import { Link } from "react-router-dom";
import { ReceiptText, RotateCcw, Star } from "lucide-react";
import { formatPrice } from "@/lib/vibe";
import { getOrderStageCopy } from "@/lib/orderLifecycle";
import type { PastOrderLine } from "@/lib/reorderValidation";

export interface PreviousOrderSummary {
  id: string;
  items?: PastOrderLine[] | unknown;
  total?: number;
  status?: string;
  order_type?: string | null;
  created_at?: string;
  createdAt?: string;
}

export interface PreviousOrderCardProps {
  order: PreviousOrderSummary;
  onReorder: (order: PreviousOrderSummary) => void;
}

const FULFILLMENT_LABELS: Record<string, string> = {
  dinein: "Dine-in",
  pickup: "Pickup",
  preorder: "Pre-order",
};

export function PreviousOrderCard({ order, onReorder }: PreviousOrderCardProps) {
  const orderNo = `BB-${String(order.id).slice(0, 6).toUpperCase()}`;
  const rawDate = order.created_at || order.createdAt || "";
  const dateLabel = rawDate
    ? new Date(rawDate).toLocaleDateString("en-GB", {
        timeZone: "Africa/Windhoek",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const itemsList = Array.isArray(order.items) ? (order.items as PastOrderLine[]) : [];
  const stage = getOrderStageCopy(order.status ?? "pending", order.order_type);
  const isCompleted = order.status === "completed";
  const fulfillLabel = FULFILLMENT_LABELS[order.order_type ?? ""] ?? "Order";

  return (
    <article className="rounded-[22px] border border-white/10 bg-[#242424] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-bold text-[#FF5A1F]">#{orderNo}</span>
            <span className="rounded-full bg-[#303030] px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {stage.label}
            </span>
            <span className="text-[12px] text-[#A3A3A3]">{fulfillLabel}</span>
          </div>
          {dateLabel && <p className="mt-1 text-[13px] text-[#A3A3A3]">{dateLabel}</p>}
        </div>
        <span className="shrink-0 text-[16px] font-extrabold tabular-nums text-white">
          {formatPrice(Number(order.total) || 0)}
        </span>
      </div>

      {itemsList.length > 0 && (
        <ul className="space-y-1.5 border-t border-white/10 pt-2.5">
          {itemsList.slice(0, 4).map((it, idx) => {
            const prefs = [
              it.weight,
              it.doneness,
              it.side ? `Side: ${it.side}` : null,
              Array.isArray(it.sauces) && it.sauces.length > 0 ? `+${it.sauces.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={idx} className="text-[14px]">
                <span className="font-semibold text-white">
                  {it.qty ?? 1}× {it.name}
                </span>
                {prefs && <span className="ml-1.5 text-[13px] text-[#A3A3A3]">({prefs})</span>}
              </li>
            );
          })}
          {itemsList.length > 4 && (
            <li className="text-[13px] text-[#A3A3A3]">+{itemsList.length - 4} more item(s)</li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onReorder(order)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#FF5A1F] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Order Again
        </button>
        <Link
          to={`/order/${order.id}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#303030] px-4 text-[14px] font-semibold text-white hover:bg-[#3A3A3A]"
        >
          <ReceiptText className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          Receipt
        </Link>
        {isCompleted && (
          <Link
            to={`/order/${order.id}?rate=1`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#303030] px-4 text-[14px] font-semibold text-white hover:bg-[#3A3A3A]"
          >
            <Star className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Rate
          </Link>
        )}
      </div>
    </article>
  );
}
