import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const scrollPositions = new Map<string, number>();

/**
 * Reset scroll on forward/push SPA navigations while restoring the prior
 * vertical scroll position on browser Back/Forward ("POP") navigations.
 */
export function ScrollToTop() {
  const { key, pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const saveScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      scrollPositions.set(key, window.scrollY);
      window.removeEventListener("scroll", saveScroll);
    };
  }, [key]);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      const saved = scrollPositions.get(key);
      if (typeof saved === "number") {
        window.scrollTo({ top: saved, left: 0, behavior: "auto" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [key, pathname, navigationType]);

  return null;
}
