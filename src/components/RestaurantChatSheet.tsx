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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex h-[min(92dvh,720px)] flex-col rounded-t-[28px] border-t border-white/12 bg-[#0c0c0c] p-0 shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Chat with Berrylicious</SheetTitle>
        <SheetDescription className="sr-only">
          Plan your night with quick picks, or type a message for the team.
        </SheetDescription>

        {/* Drag affordance */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
        </div>

        <div className="relative shrink-0 border-b border-white/8 bg-gradient-to-r from-primary/15 via-transparent to-primary/10 px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-12">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 shadow-inner shadow-primary/10">
              <MessageCircle className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-white">Berrylicious</p>
              <p className="mt-0.5 text-xs leading-snug text-white/55">
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
