import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import heroGrill from "@/assets/dish-lamb.jpg";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";
import { SlideToEnter, type SlideToEnterHandle } from "@/components/SlideToEnter";

const WELCOME_STORAGE_KEY = "bb-welcome-seen";
const IOS_CURVE = "cubic-bezier(0.32, 0.72, 0, 1)";
const MOTION_SAFE = "motion-reduce:transition-none";

function enterStyle(delayMs: number, durationMs = 620): CSSProperties {
  return {
    transitionDelay: `${delayMs}ms`,
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: IOS_CURVE,
  };
}

function hasSeenWelcome(): boolean {
  try {
    return (
      localStorage.getItem(WELCOME_STORAGE_KEY) === "1" ||
      sessionStorage.getItem(WELCOME_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export default function HomePageEditorial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceIntro = searchParams.get("intro") === "1";
  const [returningVisitor] = useState<boolean>(() => !forceIntro && hasSeenWelcome());
  const [mounted, setMounted] = useState(false);
  const [entering, setEntering] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const sliderRef = useRef<SlideToEnterHandle>(null);

  useEffect(() => {
    if (returningVisitor) return;
    // Preload Home chunk immediately so transition into /home has zero flash
    void import("@/pages/DashboardHomePage").catch(() => undefined);
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, [returningVisitor]);

  const handleSlideComplete = useCallback(() => {
    if (entering) return;
    setEntering(true);
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, "1");
      sessionStorage.setItem(WELCOME_STORAGE_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      navigate("/home", { replace: true });
    }, reduced ? 40 : 460);
  }, [entering, navigate]);

  if (returningVisitor) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      style={{
        transform: entering ? "translate3d(-100%, 0, 0)" : "translate3d(0, 0, 0)",
        opacity: entering ? 0.35 : 1,
        transition: `transform 460ms ${IOS_CURVE}, opacity 420ms ${IOS_CURVE}`,
      }}
      className={`relative isolate flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-[#0A0A0A] text-white will-change-transform ${MOTION_SAFE}`}
    >
      {/* Close-up chargrilled steak photography with subtle live slide parallax */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[24%] -z-20 overflow-hidden">
        <img
          src={heroGrill}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={{
            transform: mounted
              ? `translate3d(${Math.round(-slideProgress * 18)}px, 0, 0) scale(${(1 + slideProgress * 0.045).toFixed(3)})`
              : "translate3d(0, 0, 0) scale(1.06)",
            opacity: mounted ? 0.92 : 0,
            transition:
              slideProgress > 0 && !entering
                ? "opacity 600ms ease"
                : `transform 760ms ${IOS_CURVE}, opacity 760ms ${IOS_CURVE}`,
          }}
          className={`h-full w-full object-cover object-center will-change-transform ${MOTION_SAFE}`}
        />
      </div>

      {/* Controlled contrast vignettes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/80 via-[36%] to-[#0A0A0A]/90"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#0A0A0A] via-transparent via-[38%] to-transparent"
      />

      {/* Centered official brand identity */}
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-8 pb-20 pt-[max(56px,env(safe-area-inset-top,0px))] text-center">
        <button
          type="button"
          onClick={() => sliderRef.current?.triggerSlideComplete()}
          aria-label="Enter Butcher Block Steakhouse"
          style={{
            ...(slideProgress > 0 && !entering
              ? { transition: "opacity 600ms ease" }
              : enterStyle(50, 640)),
            transform: mounted
              ? `translate3d(0, ${Math.round(-slideProgress * 10)}px, 0)`
              : "translate3d(0, 16px, 0)",
            opacity: mounted ? 1 : 0,
          }}
          className={`group flex flex-col items-center rounded-3xl p-4 transition-[transform,opacity] will-change-transform ${MOTION_SAFE} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]`}
        >
          <img
            src={butcherBlockLogo}
            alt="Butcher Block Steakhouse"
            className="w-[240px] max-w-[68vw] object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02] sm:w-[270px]"
          />
          <p className="mt-5 text-[14px] font-medium tracking-[0.14em] text-[#A3A3A3]">
            AM WEINBERG ESTATE · WINDHOEK
          </p>
        </button>
      </div>

      {/* Bottom iOS Slide-to-Enter track */}
      <div
        style={enterStyle(160, 640)}
        className={
          `mx-auto w-full max-w-[440px] px-6 pb-[max(34px,env(safe-area-inset-bottom,0px))] transition-[transform,opacity] will-change-transform ${MOTION_SAFE} ` +
          (mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")
        }
      >
        <SlideToEnter
          ref={sliderRef}
          label="Slide to Enter"
          completedLabel="Opening Butcher Block…"
          disabled={entering}
          onProgress={setSlideProgress}
          onComplete={handleSlideComplete}
        />
      </div>
    </div>
  );
}
