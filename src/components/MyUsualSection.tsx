import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { revalidatePastOrderForReorder, type PastOrderLine } from "@/lib/reorderValidation";
import { formatPrice } from "@/lib/vibe";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";

interface RawOrderRecord {
  id: string;
  items?: PastOrderLine[] | unknown;
  created_at?: string;
  createdAt?: string;
}

interface UsualCandidate {
  key: string;
  line: PastOrderLine;
  orderCount: number;
}

function extractUsualCandidates(orders: RawOrderRecord[]): UsualCandidate[] {
  const tally = new Map<string, UsualCandidate>();
  for (const order of orders) {
    if (!Array.isArray(order.items)) continue;
    for (const raw of order.items as PastOrderLine[]) {
      if (!raw || typeof raw !== "object" || (!raw.id && !raw.name)) continue;
      const key = [
        raw.id ?? raw.name ?? "",
        raw.weight ?? "",
        raw.doneness ?? "",
        raw.side ?? "",
        Array.isArray(raw.sauces) ? raw.sauces.slice().sort().join(",") : "",
      ].join("|");
      const existing = tally.get(key);
      if (existing) {
        existing.orderCount += 1;
      } else {
        tally.set(key, {
          key,
          line: {
            id: raw.id,
            name: raw.name,
            qty: 1,
            price: raw.price,
            weight: raw.weight,
            doneness: raw.doneness,
            side: raw.side,
            sauces: raw.sauces,
          },
          orderCount: 1,
        });
      }
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 4);
}

/**
 * "My Usual Order" driven strictly by genuine past Butcher Block orders.
 * Revalidates every item against current menu availability and canonical pricing,
 * and opens ReorderPreviewSheet so items are reviewed and added to cart — never
 * auto-submitted.
 */
export function MyUsualSection({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { disabledIds } = useMenuAvailability();
  const [orders, setOrders] = useState<RawOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reorderItems, setReorderItems] = useState<PastOrderLine[] | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadError(false);

    if (user?.id) {
      setLoading(true);
      void supabase
        .from("orders")
        .select("id, items, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) {
            setLoadError(true);
            setOrders([]);
          } else {
            setOrders((data ?? []) as RawOrderRecord[]);
          }
          setLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    try {
      const parsed = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
      setOrders(Array.isArray(parsed) ? (parsed.slice().reverse() as RawOrderRecord[]) : []);
    } catch {
      setOrders([]);
    }

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const usualCandidates = useMemo(() => extractUsualCandidates(orders), [orders]);

  const validatedSummary = useMemo(
    () =>
      revalidatePastOrderForReorder(
        usualCandidates.map((c) => c.line),
        disabledIds,
      ),
    [usualCandidates, disabledIds],
  );

  // In compact mode (e.g. on MenuPage), omit completely when the guest has no past orders yet
  if (compact && (loading || loadError || validatedSummary.lines.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby="my-usual-heading" className="space-y-3">
      <div className="rounded-[24px] border border-white/10 bg-[#242424] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="my-usual-heading" className="text-[17px] font-bold text-white">
                My Usual Order
              </h2>
              <p className="text-[14px] text-[#A3A3A3]">
                Previously ordered dishes checked against today&apos;s menu
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-[14px] text-[#A3A3A3]">Loading your past dishes…</p>
        ) : loadError ? (
          <FeatureAvailabilityState
            compact
            status="error"
            title="Order history unavailable"
            description="We couldn't load your previous orders right now. You can browse the menu anytime."
            primaryAction={{ label: "Browse Menu", to: "/menu" }}
            className="bg-[#1B1B1B]"
          />
        ) : validatedSummary.lines.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 space-y-3">
            <p className="text-[14px] leading-relaxed text-[#A3A3A3]">
              Your favorites will appear here after your first order.
            </p>
            <Link
              to="/menu"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#FF5A1F] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
            >
              Browse Menu
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {validatedSummary.lines.map((line, index) => {
              const candidate = usualCandidates[index];
              const mods = [
                line.customization?.weight,
                line.customization?.doneness,
                line.customization?.side ? `Side: ${line.customization.side}` : null,
                line.customization?.sauces?.length ? `+${line.customization.sauces.join(", ")}` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-white">{line.originalName}</p>
                    {mods && <p className="mt-0.5 text-[13px] text-[#A3A3A3]">{mods}</p>}
                    {line.canAdd && line.currentUnitPrice !== null ? (
                      <p className="mt-1 text-[14px] font-extrabold tabular-nums text-[#FF5A1F]">
                        {formatPrice(line.currentUnitPrice)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] font-semibold text-amber-300">
                        {line.blockingReason || "Currently unavailable"}
                      </p>
                    )}
                  </div>

                  {line.canAdd && candidate ? (
                    <button
                      type="button"
                      onClick={() => setReorderItems([candidate.line])}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#E84D15]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Add to cart
                    </button>
                  ) : (
                    <Link
                      to="/menu"
                      className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-white/15 bg-[#242424] px-3.5 text-[13px] font-semibold text-white hover:bg-[#303030]"
                    >
                      Choose another
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReorderPreviewSheet
        open={Boolean(reorderItems)}
        onOpenChange={(open) => {
          if (!open) setReorderItems(null);
        }}
        orderNumber="USUAL"
        orderItems={reorderItems ?? []}
      />
    </section>
  );
}
