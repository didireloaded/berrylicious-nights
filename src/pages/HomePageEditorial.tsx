import { type CSSProperties, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroGrill from "@/assets/dish-lamb.jpg";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

const SMOOTH_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const MOTION_SAFE = "motion-reduce:transition-none";

function transitionStyle(delayMs: number, durationMs = 560): CSSProperties {
  return {
    transitionDelay: `${delayMs}ms`,
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: SMOOTH_EASE,
  };
}

export default function HomePageEditorial() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    try {
      sessionStorage.setItem("bb-welcome-seen", "1");
    } catch {
      /* ignore storage errors */
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      navigate("/home", { replace: true });
    }, reduced ? 40 : 420);
  };

  return (
    <div
      style={transitionStyle(0, 420)}
      className={
        `relative isolate flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-[#0A0A0A] text-white transition-all ${MOTION_SAFE} ` +
        (entering ? "scale-[1.03] opacity-0" : "scale-100 opacity-100")
      }
    >
      {/* Close-up chargrilled steak photography anchored cleanly into deep charcoal */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[24%] -z-20 overflow-hidden">
        <img
          src={heroGrill}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={transitionStyle(0, 900)}
          className={
            `h-full w-full object-cover object-center transition-all ${MOTION_SAFE} ` +
            (mounted ? "scale-100 opacity-90" : "scale-105 opacity-0")
          }
        />
      </div>

      {/* Controlled contrast vignettes: pure dark charcoal top for crisp logo + grounded bottom for CTA */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/80 via-[36%] to-[#0A0A0A]/90"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#0A0A0A] via-transparent via-[38%] to-transparent"
      />

      {/* Centered upper-middle official brand identity */}
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-8 pb-20 pt-[max(56px,env(safe-area-inset-top,0px))] text-center">
        <button
          type="button"
          onClick={handleEnter}
          aria-label="Enter Butcher Block Steakhouse"
          style={transitionStyle(60, 680)}
          className={
            `group flex flex-col items-center rounded-3xl p-4 transition-all ${MOTION_SAFE} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] ` +
            (mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")
          }
        >
          <img
            src={butcherBlockLogo}
            alt="Butcher Block Steakhouse"
            className="w-[240px] max-w-[68vw] object-contain transition-transform duration-300 group-hover:scale-[1.02] sm:w-[270px]"
          />
          <p className="mt-5 text-[14px] font-medium tracking-[0.14em] text-[#A3A3A3]">
            AM WEINBERG ESTATE · WINDHOEK
          </p>
        </button>
      </div>

      {/* Bottom iOS cinematic entry pill matching approved reference */}
      <div
        style={transitionStyle(180, 680)}
        className={
          `mx-auto w-full max-w-[440px] px-6 pb-[max(34px,env(safe-area-inset-bottom,0px))] transition-all ${MOTION_SAFE} ` +
          (mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")
        }
      >
        <button
          type="button"
          onClick={handleEnter}
          disabled={entering}
          className="group relative flex min-h-[58px] w-full items-center justify-center rounded-full border border-white/15 bg-[#1B1B1B]/90 pl-6 pr-2 text-[16px] font-semibold text-white backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-[#242424] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          <span className="pr-10 tracking-[-0.01em]">
            {entering ? "Opening Butcher Block…" : "Tap to Enter"}
          </span>
          <span className="absolute right-1.5 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#FF5A1F] text-white transition-transform duration-200 group-hover:scale-[1.04]">
            <ArrowRight className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  );
}
