import { useRef } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { RestaurantChatPanel } from "@/components/RestaurantChatPanel";
import { cn } from "@/lib/utils";

type RestaurantChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RestaurantChatSheet({ open, onOpenChange }: RestaurantChatSheetProps) {
  const { user, loading } = useAuth();
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartY.current;
    if (endY - dragStartY.current > 72) {
      onOpenChange(false);
    }
    dragStartY.current = null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className={cn(
          "flex h-[min(92dvh,720px)] flex-col rounded-t-[28px] border-t border-white/12 bg-[#121212] p-0 shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Chat with Butcher Block</SheetTitle>
        <SheetDescription className="sr-only">
          Plan your night with quick picks, or type a message for the team.
        </SheetDescription>

        {/* Drag affordance */}
        <div
          className="flex shrink-0 justify-center pt-3 pb-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div
          className="relative shrink-0 border-b border-white/10 bg-[#181818] px-4 pb-4 pt-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-0.5 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white/85 transition-colors hover:bg-[#303030] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-start gap-3 pr-14">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#FF5A1F]/35 bg-[#FF5A1F]/15">
              <MessageCircle className="h-5 w-5 text-[#FF5A1F]" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-white">Butcher Block</p>
              <p className="mt-0.5 text-[13px] leading-snug text-[#A3A3A3]">
                We're here to help — ask about the menu, events, or book a table.
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#0b0b0b]">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10 text-center">
              <div className="rounded-2xl border border-border bg-card/50 px-5 py-6 backdrop-blur-sm">
                <p className="font-display text-base font-semibold text-foreground">Sign in to chat</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We keep conversations private to your account so we can help with orders and bookings.
                </p>
              </div>
              <Link
                to="/auth"
                state={{ from: "/" }}
                onClick={() => onOpenChange(false)}
                className="w-full max-w-xs rounded-2xl bg-primary py-3.5 text-center text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 btn-press"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </button>
            </div>
          ) : (
            <RestaurantChatPanel
              active={open}
              realtimeScope="home-sheet"
              listClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_120px)]"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
