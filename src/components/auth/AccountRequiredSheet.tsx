import { useLocation, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { savePendingRedirect } from "@/lib/authUtils";

export interface AccountRequiredSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  redirectTo?: string;
}

/**
 * Contextual iOS bottom sheet presented only when a guest taps a genuine account-backed feature.
 * Preserves the guest's current destination and never interrupts normal menu or cart browsing.
 */
export function AccountRequiredSheet({
  open,
  onOpenChange,
  title = "Keep Your Favourites Close.",
  description = "Sign in to save your preferences and access your account across devices.",
  redirectTo,
}: AccountRequiredSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const target = redirectTo || `${location.pathname}${location.search}`;

  const goTo = (authPath: string) => {
    savePendingRedirect(target);
    onOpenChange(false);
    navigate(authPath, { state: { from: target } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[520px] rounded-t-[28px] border-t border-white/10 bg-[#1A1A1A] px-6 pb-[max(28px,env(safe-area-inset-bottom,0px))] pt-5 text-white"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />

        <SheetHeader className="text-left">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF5A1F]/25 bg-[#FF5A1F]/15 text-[#FF5A1F]">
            <Heart className="h-6 w-6" aria-hidden="true" />
          </div>
          <SheetTitle className="font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white">
            {title}
          </SheetTitle>
          <SheetDescription className="mt-1.5 text-[15px] leading-relaxed text-[#A3A3A3]">
            {description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => goTo("/auth/sign-in")}
            className="bb-press flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => goTo("/auth/sign-up")}
            className="bb-press flex min-h-[50px] w-full items-center justify-center rounded-full border border-white/15 bg-[#242424] px-6 text-[15px] font-semibold text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bb-press flex min-h-[46px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Not Now
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
