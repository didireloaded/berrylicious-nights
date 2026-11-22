import { useState } from "react";
import { Calculator, Users, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BillSplitPreview, type SplitPreviewCartItem } from "@/components/BillSplitPreview";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import { cn } from "@/lib/utils";

export interface GroupOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: SplitPreviewCartItem[];
  tableLabel?: string | null;
  groupBackendStatus?: FeatureAvailabilityStatus;
  onCreateGroup?: () => void;
}

/**
 * Contextual "Ordering with friends?" bottom sheet accessed from Cart.
 * - Split Preview tab provides a real integer-cent local calculator on the user's cart.
 * - Shared Group Order tab remains honestly unavailable when multi-user sync backend
 *   is not connected — never generating fake join codes or claiming invites were sent.
 */
export function GroupOrderSheet({
  open,
  onOpenChange,
  cartItems,
  tableLabel = null,
  groupBackendStatus = "coming_soon",
  onCreateGroup,
}: GroupOrderSheetProps) {
  const [tab, setTab] = useState<"split" | "group">(cartItems.length > 0 ? "split" : "group");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className={cn(
          "flex max-h-[min(90dvh,760px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Ordering with Friends</SheetTitle>
        <SheetDescription className="sr-only">
          Preview how to split your current cart total or view shared group-ordering availability.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-bold text-white">Ordering with friends</h2>
              <p className="text-[13px] text-[#A3A3A3]">
                {tableLabel ? `${tableLabel} · Split preview & shared dining` : "Split preview & shared table orders"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close ordering with friends"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="shrink-0 px-5 pt-3.5">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#181818] p-1">
            <button
              type="button"
              onClick={() => setTab("split")}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors",
                tab === "split" ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
              )}
            >
              <Calculator className="h-4 w-4" aria-hidden="true" />
              Split Preview
            </button>
            <button
              type="button"
              onClick={() => setTab("group")}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors",
                tab === "group" ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
              )}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Shared Group Order
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {tab === "split" ? (
            <BillSplitPreview items={cartItems} />
          ) : groupBackendStatus === "available" && onCreateGroup ? (
            <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5 space-y-4">
              <div>
                <p className="text-[16px] font-bold text-white">Start a shared table order</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#A3A3A3]">
                  Everyone at your table adds their dishes from their own phone into one combined kitchen ticket.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onCreateGroup();
                }}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white hover:bg-[#E84D15]"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Open Group Order
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <FeatureAvailabilityState
                status={groupBackendStatus === "available" ? "coming_soon" : groupBackendStatus}
                title="Shared multi-phone group ordering is coming soon"
                description="Live group join codes and multi-device syncing aren't connected yet. Right now you can build your table's order in one cart and use Split Preview to calculate each person's share."
                primaryAction={
                  cartItems.length > 0
                    ? { label: "Open Split Preview", onClick: () => setTab("split") }
                    : undefined
                }
              />

              {/* Frontend-ready disabled controls previewing future shared actions */}
              <div className="rounded-[22px] border border-white/10 bg-[#1B1B1B] p-4 space-y-2.5 opacity-60">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                  Shared Table Actions (Unavailable)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled
                    className="min-h-[44px] cursor-not-allowed rounded-full border border-white/10 bg-[#242424] px-3 text-[13px] font-semibold text-[#A3A3A3]"
                  >
                    Create group
                  </button>
                  <button
                    type="button"
                    disabled
                    className="min-h-[44px] cursor-not-allowed rounded-full border border-white/10 bg-[#242424] px-3 text-[13px] font-semibold text-[#A3A3A3]"
                  >
                    Join by code
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
