import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  MapPin,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import type { ActiveTableSession } from "@/lib/tableService";

export interface TableSessionHeaderProps {
  session: ActiveTableSession;
  cartCount?: number;
  activeOrderId?: string | null;
  onBrowseMenu: () => void;
  onRequestWaiter: () => void;
}

/**
 * Reusable presentation component for a genuinely validated QR table session.
 * Never rendered from an unvalidated URL parameter.
 */
export function TableSessionHeader({
  session,
  cartCount = 0,
  activeOrderId = null,
  onBrowseMenu,
  onRequestWaiter,
}: TableSessionHeaderProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-[#FF5A1F]/35 bg-[#242424] p-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-bold text-[#FF5A1F]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Validated Table Session
        </div>
        <h1 className="mt-3 font-display text-[28px] font-extrabold tracking-[-0.035em] text-white">
          {session.displayName}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[#A3A3A3]">
          <MapPin className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          Butcher Block Steakhouse · {session.area}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#C4C4C4]">
          Your table is connected for dine-in ordering. Browse the menu, review your cart before submitting, or call your waiter anytime.
        </p>
      </section>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onBrowseMenu}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15]"
        >
          <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
          Browse Menu
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            to="/cart"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030]"
          >
            <ShoppingBag className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Cart{cartCount > 0 ? ` (${cartCount})` : ""}
          </Link>

          <button
            type="button"
            onClick={onRequestWaiter}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030]"
          >
            <BellRing className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Call Waiter
          </button>
        </div>

        {activeOrderId && (
          <Link
            to={`/order/${activeOrderId}`}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030]"
          >
            <ReceiptText className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            View Active Order
          </Link>
        )}
      </div>
    </div>
  );
}
