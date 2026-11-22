import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
  hideBack?: boolean;
  onBack?: () => void;
  topRight?: ReactNode;
}

/**
 * Full-screen iOS-inspired authentication canvas.
 * - Native charcoal surface (#121212), zero floating card box clutter
 * - Safe-area top/bottom padding and keyboard-safe vertical scrolling
 * - Works cleanly from 320px phones up to desktop browsers
 */
export function AuthLayout({
  children,
  backTo = "/home",
  backLabel = "Back",
  hideBack = false,
  onBack,
  topRight,
}: AuthLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(backTo, { replace: true });
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#121212] text-white">
      {/* Top safe-area navigation bar */}
      <div className="mx-auto flex w-full max-w-[460px] items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top,0px))]">
        {!hideBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={backLabel}
            className="bb-press flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="block h-11 w-11" aria-hidden="true" />
        )}
        {topRight ?? <span className="block h-11 w-11" aria-hidden="true" />}
      </div>

      {/* Keyboard-safe scrollable main content */}
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 pb-[max(32px,env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </div>
    </div>
  );
}
