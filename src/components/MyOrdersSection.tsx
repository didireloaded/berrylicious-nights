import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ReceiptText, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/vibe";
import { getOrderStageCopy } from "@/lib/orderLifecycle";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import type { PastOrderLine } from "@/lib/reorderValidation";

interface OrderHistoryRow {
  id: string;
  items?: PastOrderLine[] | unknown;
  total?: number;
  status?: string;
  order_type?: string | null;
  payment_status?: string | null;
  arrival_code?: string | null;
  created_at?: string;
  createdAt?: string;
}

const FULFILLMENT_LABELS: Record<string, string> = {
  dinein: "Dine-in",
  pickup: "Pickup",
  preorder: "Pre-order",
};

export function MyOrdersSection() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<OrderHistoryRow | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimOrderId, setClaimOrderId] = useState("");
  const [claimArrivalCode, setClaimArrivalCode] = useState("");
  const [claiming, setClaiming] = useState(false);

  const loadOrders = useCallback(async () => {
    if (user?.id) {
      // Signed-in accounts ONLY read server-authorized orders owned by auth.uid()
      // (never mixing guest localStorage orders from another user on a shared device)
      setLoading(true);
      try {
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25);
        setOrders((data ?? []) as OrderHistoryRow[]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Unsigned guest mode: only show orders tracked on this device session
    try {
      const parsed = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
      setOrders(Array.isArray(parsed) ? (parsed.slice().reverse() as OrderHistoryRow[]) : []);
    } catch {
      setOrders([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleClaimGuestOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || claiming) return;
    const idTrim = claimOrderId.trim();
    const codeTrim = claimArrivalCode.trim();
    if (!idTrim || codeTrim.length < 4) {
      toast.error("Enter the full Order UUID and its arrival code from your receipt.");
      return;
    }
    setClaiming(true);
    try {
      type ClaimRpc = {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
      const { data, error } = await (supabase as unknown as ClaimRpc).rpc(
        "claim_guest_order_by_arrival_code",
        { p_order_id: idTrim, p_arrival_code: codeTrim },
      );
      if (error || !data) {
        toast.error("Order could not be claimed — check that the ID and arrival code match an unclaimed guest order.");
        return;
      }
      toast.success("Guest order securely linked to your account");
      setClaimOrderId("");
      setClaimArrivalCode("");
      setShowClaim(false);
      await loadOrders();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <section aria-labelledby="my-orders-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="my-orders-heading" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
          My Orders
        </h2>
        {user && (
          <button
            type="button"
            onClick={() => setShowClaim((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF5A1F] hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {showClaim ? "Hide claim" : "Claim guest order"}
          </button>
        )}
      </div>

      {user && showClaim && (
        <form
          onSubmit={handleClaimGuestOrder}
          className="rounded-[20px] border border-white/10 bg-[#242424] p-4 space-y-2.5"
        >
          <p className="text-[13px] font-semibold text-white">Link a guest receipt to your account</p>
          <p className="text-[12px] text-[#A3A3A3]">
            Verify with both your order ID and arrival code so only the original guest can claim an order.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={claimOrderId}
              onChange={(e) => setClaimOrderId(e.target.value)}
              placeholder="Order UUID"
              className="min-h-[42px] rounded-xl border border-white/10 bg-[#181818] px-3 text-[13px] text-white"
            />
            <input
              type="text"
              value={claimArrivalCode}
              onChange={(e) => setClaimArrivalCode(e.target.value)}
              placeholder="Arrival code (e.g. BB-4821)"
              className="min-h-[42px] rounded-xl border border-white/10 bg-[#181818] px-3 text-[13px] text-white"
            />
          </div>
          <button
            type="submit"
            disabled={claiming}
            className="min-h-[42px] rounded-full bg-[#FF5A1F] px-5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {claiming ? "Verifying…" : "Claim Order"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="py-4 text-[13px] text-[#A3A3A3]">Loading your orders…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-[20px] border border-white/10 bg-[#242424] p-5 text-center">
          <p className="text-[14px] font-semibold text-white">No past orders yet</p>
          <p className="mt-1 text-[13px] text-[#A3A3A3]">
            Your Butcher Block orders, steak preferences, and one-tap reorder history will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
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
              <article
                key={order.id}
                className="rounded-[22px] border border-white/10 bg-[#242424] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[13px] font-bold text-[#FF5A1F]">#{orderNo}</span>
                      <span className="rounded-full bg-[#303030] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {stage.label}
                      </span>
                      <span className="text-[12px] text-[#A3A3A3]">{fulfillLabel}</span>
                    </div>
                    {dateLabel && <p className="mt-0.5 text-[12px] text-[#A3A3A3]">{dateLabel}</p>}
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
                        <li key={idx} className="text-[13px]">
                          <span className="font-semibold text-white">
                            {it.qty ?? 1}× {it.name}
                          </span>
                          {prefs && <span className="ml-1.5 text-[12px] text-[#A3A3A3]">({prefs})</span>}
                        </li>
                      );
                    })}
                    {itemsList.length > 4 && (
                      <li className="text-[12px] text-[#A3A3A3]">+{itemsList.length - 4} more item(s)</li>
                    )}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReorderTarget(order)}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#E84D15]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Order Again
                  </button>
                  <Link
                    to={`/order/${order.id}`}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#303030] px-4 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]"
                  >
                    <ReceiptText className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                    Receipt
                  </Link>
                  {isCompleted && (
                    <Link
                      to={`/order/${order.id}?rate=1`}
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#303030] px-4 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]"
                    >
                      <Star className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                      Rate
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reorderTarget && (
        <ReorderPreviewSheet
          open={Boolean(reorderTarget)}
          onOpenChange={(open) => {
            if (!open) setReorderTarget(null);
          }}
          orderNumber={`BB-${String(reorderTarget.id).slice(0, 6).toUpperCase()}`}
          orderItems={reorderTarget.items}
        />
      )}
    </section>
  );
}
