import { Link, useLocation } from "react-router-dom";
import { BellRing, Users, X } from "lucide-react";
import { useTableSession } from "@/context/TableSessionContext";

/**
 * Slim contextual bar shown ONLY when the customer has scanned a valid active table QR code.
 * Avoids obstructing food cards with a permanent floating button while keeping waiter assistance one tap away.
 */
export function TableContextBar() {
  const { pathname } = useLocation();
  const { session, openServiceSheet, clearSession } = useTableSession();

  if (!session || pathname === "/" || pathname.startsWith("/admin")) return null;

  return (
    <div className="border-b border-white/10 bg-[#1A1A1A]/95 px-4 py-2 text-white backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF5A1F]" aria-hidden="true" />
          <span className="truncate font-bold text-white">{session.displayName}</span>
          <span className="hidden text-[#A3A3A3] sm:inline">· {session.area}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/group/new"
            className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-white/15 bg-[#242424] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]"
          >
            <Users className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
            Group
          </Link>
          <button
            type="button"
            onClick={openServiceSheet}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-[#FF5A1F] px-3 text-[12px] font-bold text-white hover:bg-[#E84D15]"
          >
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
            Waiter
          </button>
          <button
            type="button"
            onClick={clearSession}
            aria-label="Leave table session"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#A3A3A3] hover:bg-[#303030] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
