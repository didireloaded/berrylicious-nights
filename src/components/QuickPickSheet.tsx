import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Plus, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { BookingNavState } from "@/lib/eventBooking";
import { formatPrice } from "@/lib/vibe";
import { menuItemsForQuickPick, type QuickPickConfig } from "@/lib/quickPicks";

type QuickPickSheetProps = {
  pick: QuickPickConfig | null;
  onClose: () => void;
};

export function QuickPickSheet({ pick, onClose }: QuickPickSheetProps) {
  const navigate = useNavigate();
  const { addItem } = useCart();

  useEffect(() => {
    if (!pick) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pick]);

  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, onClose]);

  if (!pick) return null;

  const dishes = menuItemsForQuickPick(pick.menuItemIds);
  const today = new Date().toISOString().split("T")[0];

  const goBook = () => {
    const state: BookingNavState = {
      suggestedDate: today,
      suggestedTime: pick.suggestedTime,
      suggestedGuests: pick.suggestedGuests,
    };
    onClose();
    navigate("/booking", { state });
  };

  const sheet = (
    <div className="fixed inset-0 z-[100] flex flex-col pointer-events-none">
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-[20dvh] flex-1 pointer-events-auto bg-background/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-pick-title"
        className="pointer-events-auto mx-auto flex max-h-[min(85dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl border border-border border-b-0 bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.45)] animate-panel-up"
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Quick pick</p>
          <h2 id="quick-pick-title" className="font-display mt-1 text-xl font-bold text-foreground">
            {pick.label}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{pick.tagline}</p>
          <p className="mt-4 text-sm text-foreground">
            <span className="text-muted-foreground">Suggested time </span>
            <span className="font-semibold text-primary">{pick.suggestedTime}</span>
            <span className="text-muted-foreground"> · {pick.suggestedGuests} guests</span>
          </p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chef picks for this
          </p>
          <div className="mt-3 space-y-3">
            {dishes.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-xl border border-border bg-card/80 p-3"
              >
                <img
                  src={item.image}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  decoding="async"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm leading-tight">{item.name}</p>
                  <p className="text-primary text-sm font-semibold mt-1">{formatPrice(item.price)}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground btn-press"
                    aria-label={`Add ${item.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Link
                    to={`/menu/${item.id}`}
                    onClick={onClose}
                    className="text-[10px] text-center text-muted-foreground hover:text-foreground"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={goBook}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground btn-press"
          >
            <CalendarDays className="h-5 w-5 shrink-0" />
            Book this time
          </button>
          <Link
            to="/menu"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-foreground btn-press"
          >
            <UtensilsCrossed className="h-5 w-5 shrink-0" />
            Full menu
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
