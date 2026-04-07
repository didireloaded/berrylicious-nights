import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Reset scroll on client-side navigation (expected SPA behaviour). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
