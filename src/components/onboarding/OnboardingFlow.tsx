import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishBurger from "@/assets/dish-burger.jpg";
import heroRestaurant from "@/assets/hero-restaurant.jpg";
import { foodItems } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";
import { markOnboardingCompleted } from "@/lib/authUtils";
import { OnboardingSlide } from "./OnboardingSlide";
import { OnboardingProgress } from "./OnboardingProgress";

const TOTAL_STEPS = 3;
const SWIPE_THRESHOLD_PX = 48;

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const lockedHorizontal = useRef<boolean | null>(null);

  // Pull genuine Butcher Block menu cuts for Slide 02's subtle real menu preview
  const signaturePreview = useMemo(() => {
    const ids = ["cc-ribeye", "6"];
    return ids
      .map((id) => foodItems.find((item) => item.id === id))
      .filter((item): item is (typeof foodItems)[number] => item != null);
  }, []);

  useEffect(() => {
    // Preload Home & Auth chunks immediately so transitioning out feels instantaneous
    void import("@/pages/DashboardHomePage").catch(() => undefined);
    void import("@/pages/AuthPage").catch(() => undefined);
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const finishTo = useCallback(
    (destination: string) => {
      markOnboardingCompleted();
      navigate(destination, { replace: true });
    },
    [navigate],
  );

  const goNext = useCallback(() => {
    setStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  // Accessible keyboard arrow navigation across onboarding slides
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setStep((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Natural lightweight horizontal swipe gesture (Pointer Events — no carousel dependency)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement | null)?.closest("button, a, input")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    lockedHorizontal.current = null;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;

    if (lockedHorizontal.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      lockedHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!lockedHorizontal.current) return;

    // Gentle rubber-band resistance at first & last slide boundaries
    const atEdge = (step === 0 && dx > 0) || (step === TOTAL_STEPS - 1 && dx < 0);
    setDragDeltaX(atEdge ? dx * 0.25 : dx);
  };

  const handlePointerEnd = () => {
    if (pointerStartX.current === null) return;
    const dx = dragDeltaX;
    pointerStartX.current = null;
    pointerStartY.current = null;
    lockedHorizontal.current = null;
    setIsDragging(false);
    setDragDeltaX(0);

    if (dx <= -SWIPE_THRESHOLD_PX && step < TOTAL_STEPS - 1) {
      goNext();
    } else if (dx >= SWIPE_THRESHOLD_PX && step > 0) {
      goBack();
    }
  };

  const slide02MenuPreview = (
    <div className="flex flex-wrap gap-2" aria-label="Featured cuts from our menu">
      {signaturePreview.map((dish) => (
        <div
          key={dish.id}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1C1C1C]/85 px-3.5 py-2 text-[13px] backdrop-blur-md"
        >
          <span className="font-semibold text-white">{dish.name}</span>
          <span className="text-white/35">·</span>
          <span className="font-bold tabular-nums text-[#FF5A1F]">{formatPrice(dish.price)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="relative min-h-dvh w-full select-none overflow-hidden bg-[#0A0A0A] text-white"
    >
      {/* Top Floating Bar: Back (Step 2+) and Skip (Steps 1–2) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 mx-auto flex max-w-[520px] items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top,0px))]">
        <div className="pointer-events-auto">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Previous step"
              className="bb-press flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#121212]/70 text-white backdrop-blur-md hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span className="block h-11 w-11" aria-hidden="true" />
          )}
        </div>

        <div className="pointer-events-auto">
          {step < TOTAL_STEPS - 1 && (
            <button
              type="button"
              onClick={() => finishTo("/home")}
              className="bb-press inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[14px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Horizontal GPU Slide Track */}
      <div
        style={{
          transform: `translate3d(calc(${-step * 100}% + ${dragDeltaX}px), 0, 0)`,
          transition: isDragging
            ? "none"
            : "transform 440ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        className="flex w-full will-change-transform motion-reduce:transition-none"
      >
        <OnboardingSlide
          active={mounted && step === 0}
          image={dishLamb}
          showTopLogo
          headline="A Cut Above the Rest."
          supportingText="Great food. Great company. All in one place."
        />

        <OnboardingSlide
          active={mounted && step === 1}
          image={dishBurger}
          imagePosition="object-center"
          headline="Find Your Perfect Cut."
          supportingText="Explore our menu, choose your favourites and make every meal your own."
          visualAccent={slide02MenuPreview}
        />

        <OnboardingSlide
          active={mounted && step === 2}
          image={heroRestaurant}
          imagePosition="object-center"
          headline="Make Yourself at Home."
          supportingText="Book a table, order your favourites and follow your meal from the kitchen."
        />
      </div>

      {/* Persistent Bottom Navigation & Final Auth Entry Actions */}
      <div
        className={
          "fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[460px] px-6 pb-[max(26px,env(safe-area-inset-bottom,0px))] pt-3 transition-all delay-100 duration-500 bb-ease-spring motion-reduce:transition-none " +
          (mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")
        }
      >
        <OnboardingProgress
          totalSteps={TOTAL_STEPS}
          currentStep={step}
          onSelectStep={setStep}
          className="mb-4"
        />

        {step === 0 && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={goNext}
              className="bb-press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.3)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Get Started
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => finishTo("/home")}
              className="bb-press flex min-h-[44px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Explore as Guest
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={goNext}
              className="bb-press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.3)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goBack}
              className="bb-press flex min-h-[44px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Back
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => finishTo("/auth/sign-up")}
              className="bb-press flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.3)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Create an Account
            </button>
            <button
              type="button"
              onClick={() => finishTo("/auth/sign-in")}
              className="bb-press flex min-h-[50px] w-full items-center justify-center rounded-full border border-white/15 bg-[#242424]/95 px-6 text-[15px] font-semibold text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              I Already Have an Account
            </button>
            <button
              type="button"
              onClick={() => finishTo("/home")}
              className="bb-press flex min-h-[44px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#D4D4D4] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Explore as Guest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
