import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Compass, MessageCircle, Sparkles, UtensilsCrossed } from "lucide-react";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";

/** Quick actions based on real app routes and the existing restaurant contact/chat sheets. */
export function RestaurantActionPills() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { openAbout } = useAboutSheet();
  const { openAssistant } = useRestaurantAssistant();

  const explore = () => {
    if (pathname !== "/menu") {
      navigate("/menu");
      return;
    }
    document.getElementById("menu-full-list")?.scrollIntoView({ block: "start" });
  };

  const common = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]";

  return (
    <div aria-label="Restaurant quick actions" className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button type="button" onClick={openAssistant} className={common + " bg-[#ff5a1f] text-white hover:bg-[#ef4f17]"}>
        <Sparkles className="h-4 w-4" aria-hidden="true" /> Ask
      </button>
      <Link to="/menu" className={common + " border border-white/15 bg-[#242424] text-white/85 hover:bg-[#303030]"}>
        <UtensilsCrossed className="h-4 w-4" aria-hidden="true" /> Menu
      </Link>
      <button type="button" onClick={openAbout} className={common + " border border-white/15 bg-[#242424] text-white/85 hover:bg-[#303030]"}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact
      </button>
      <button type="button" onClick={explore} className={common + " border border-white/15 bg-[#242424] text-white/85 hover:bg-[#303030]"}>
        <Compass className="h-4 w-4" aria-hidden="true" /> Explore
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
