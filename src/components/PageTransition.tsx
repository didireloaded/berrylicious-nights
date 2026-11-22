import { useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const TOP_LEVEL_TABS = new Set(["/home", "/menu", "/drinks", "/cart", "/booking", "/profile"]);

/**
 * Lightweight, GPU-composited iOS-style route transition wrapper.
 * Chooses subtle directional motion based on navigation context:
 * - Welcome -> Home: smooth upward reveal
 * - Tab -> Tab: crisp fast cross-lift
 * - Drill-down (e.g. Menu -> Dish detail, Cart -> Order tracker): gentle push-in
 * - Browser Back (POP): gentle pop-in
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const lastPathRef = useRef<string>(pathname);
  const animClassRef = useRef<string>(pathname === "/" ? "" : "bb-page-tab");

  if (lastPathRef.current !== pathname) {
    const prev = lastPathRef.current;
    if (pathname === "/") {
      animClassRef.current = "";
    } else if (prev === "/") {
      animClassRef.current = "bb-page-welcome";
    } else if (navigationType === "POP") {
      animClassRef.current = "bb-page-pop";
    } else if (TOP_LEVEL_TABS.has(prev) && TOP_LEVEL_TABS.has(pathname)) {
      animClassRef.current = "bb-page-tab";
    } else {
      animClassRef.current = "bb-page-push";
    }
    lastPathRef.current = pathname;
  }

  return (
    <div key={pathname} className={animClassRef.current}>
      {children}
    </div>
  );
}
