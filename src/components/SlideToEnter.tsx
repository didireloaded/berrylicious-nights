import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlideToEnterHandle {
  /** Programmatically slides the knob smoothly across the track and completes entry. */
  triggerSlideComplete: () => void;
}

export interface SlideToEnterProps {
  label?: string;
  completedLabel?: string;
  disabled?: boolean;
  onProgress?: (progress: number) => void;
  onComplete: () => void;
  className?: string;
}

const THUMB_SIZE = 50;
const TRACK_PADDING = 6;
const COMPLETE_THRESHOLD = 0.72;

/**
 * Native iOS-style Slide-to-Enter control.
 * - 1:1 60/120fps pointer drag via setPointerCapture + GPU translate3d
 * - Progressive orange fill trail + shimmering directional label
 * - Smooth spring-back on incomplete release
 * - Accessible slider semantics (keyboard Enter/Space/ArrowRight + click fallback)
 */
export const SlideToEnter = forwardRef<SlideToEnterHandle, SlideToEnterProps>(
  function SlideToEnter(
    {
      label = "Slide to Enter",
      completedLabel = "Entering Butcher Block",
      disabled = false,
      onProgress,
      onComplete,
      className,
    },
    ref,
  ) {
    const trackRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);
    const startXRef = useRef(0);
    const startOffsetRef = useRef(0);
    const currentOffsetRef = useRef(0);
    const movedRef = useRef(false);
    const completedRef = useRef(false);
    const nudgeTimerRef = useRef<number | null>(null);

    const [maxTravel, setMaxTravel] = useState(260);
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [completed, setCompleted] = useState(false);

    const setOffsetSynced = useCallback((value: number) => {
      currentOffsetRef.current = value;
      setOffsetX(value);
    }, []);

    const clearNudgeTimer = useCallback(() => {
      if (nudgeTimerRef.current !== null) {
        window.clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
    }, []);

    useEffect(() => clearNudgeTimer, [clearNudgeTimer]);

    const measureTrack = useCallback(() => {
      const el = trackRef.current;
      if (!el) return 260;
      const travel = Math.max(80, el.clientWidth - THUMB_SIZE - TRACK_PADDING * 2);
      setMaxTravel(travel);
      return travel;
    }, []);

    useEffect(() => {
      measureTrack();
      if (typeof ResizeObserver === "undefined" || !trackRef.current) return;
      const ro = new ResizeObserver(() => measureTrack());
      ro.observe(trackRef.current);
      return () => ro.disconnect();
    }, [measureTrack]);

    const progress = maxTravel > 0 ? Math.min(1, Math.max(0, offsetX / maxTravel)) : 0;

    useEffect(() => {
      onProgress?.(progress);
    }, [progress, onProgress]);

    const finalizeEntry = useCallback(() => {
      if (completedRef.current) return;
      clearNudgeTimer();
      completedRef.current = true;
      const travel = measureTrack();
      setIsDragging(false);
      setOffsetSynced(travel);
      setCompleted(true);
      onProgress?.(1);
      onComplete();
    }, [clearNudgeTimer, measureTrack, onComplete, onProgress, setOffsetSynced]);

    useImperativeHandle(
      ref,
      () => ({
        triggerSlideComplete: finalizeEntry,
      }),
      [finalizeEntry],
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || completedRef.current) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      clearNudgeTimer();
      const travel = measureTrack();
      draggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startOffsetRef.current = Math.min(travel, currentOffsetRef.current);
      movedRef.current = false;
      setIsDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported */
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || completedRef.current) return;
      const delta = e.clientX - startXRef.current;
      if (Math.abs(delta) > 4) movedRef.current = true;
      const next = Math.min(maxTravel, Math.max(0, startOffsetRef.current + delta));
      setOffsetSynced(next);

      if (maxTravel > 0 && next / maxTravel >= 0.96) {
        draggingRef.current = false;
        finalizeEntry();
      }
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (pointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        } catch {
          /* already released */
        }
        pointerIdRef.current = null;
      }
      setIsDragging(false);

      if (completedRef.current) return;

      const currentProgress = maxTravel > 0 ? currentOffsetRef.current / maxTravel : 0;
      if (currentProgress >= COMPLETE_THRESHOLD) {
        finalizeEntry();
      } else if (!movedRef.current) {
        // Gentle iOS-style rightward nudge hint when tapped instead of dragged
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
          setOffsetSynced(0);
          return;
        }
        const hintDistance = Math.min(28, Math.round(maxTravel * 0.14));
        setOffsetSynced(hintDistance);
        nudgeTimerRef.current = window.setTimeout(() => {
          nudgeTimerRef.current = null;
          if (!draggingRef.current && !completedRef.current) {
            setOffsetSynced(0);
          }
        }, 200);
      } else {
        // Spring cleanly back to start
        setOffsetSynced(0);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || completedRef.current) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        finalizeEntry();
      }
    };

    const labelOpacity = completed ? 1 : Math.max(0, 1 - progress * 1.65);

    return (
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label}. Drag right or press Enter to enter Butcher Block Steakhouse.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-disabled={disabled || completed}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex h-[62px] w-full select-none items-center overflow-hidden rounded-full border border-white/15 bg-[#1A1A1A]/90 p-1.5 backdrop-blur-md touch-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]",
          completed && "border-[#FF5A1F]/60 bg-[#FF5A1F]/15 cursor-default",
          className,
        )}
      >
        {/* 100% GPU-composited progressive orange fill (transform-only, zero layout shift) */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(calc(-100% + ${THUMB_SIZE + offsetX + TRACK_PADDING}px), 0, 0)`,
            opacity: completed ? 1 : 0.45 + progress * 0.55,
            transition: isDragging
              ? "none"
              : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease",
          }}
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-[#FF5A1F]/20 via-[#FF5A1F]/35 to-[#FF5A1F]/50 will-change-transform"
        />

        {/* Centered shimmer text & gliding chevrons */}
        <div
          style={{
            opacity: labelOpacity,
            transform: completed
              ? "translate3d(-12px, 0, 0)"
              : `translate3d(${Math.round(progress * 14)}px, 0, 0)`,
            transition: isDragging
              ? "none"
              : "opacity 240ms ease, transform 340ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className="pointer-events-none flex w-full items-center justify-center gap-1.5 pl-10 pr-4"
        >
          <span
            className={cn(
              "text-[16px] font-semibold tracking-[-0.015em]",
              completed ? "text-white" : "bb-slide-shimmer-text",
            )}
          >
            {completed ? completedLabel : label}
          </span>
          {!completed && (
            <span className="flex items-center -space-x-1.5 text-white/60" aria-hidden="true">
              <ChevronRight className="bb-chevron-1 h-4 w-4" strokeWidth={2.2} />
              <ChevronRight className="bb-chevron-2 h-4 w-4" strokeWidth={2.2} />
            </span>
          )}
        </div>

        {/* Draggable tactile orange thumb */}
        <div
          aria-hidden="true"
          style={{
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
            transform: `translate3d(${offsetX}px, 0, 0) scale(${isDragging ? 1.05 : completed ? 1.02 : 1})`,
            transition: isDragging
              ? "none"
              : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease",
          }}
          className={cn(
            "pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center justify-center rounded-full bg-[#FF5A1F] text-white shadow-[0_6px_20px_rgba(255,90,31,0.42)]",
            isDragging && "shadow-[0_8px_26px_rgba(255,90,31,0.58)]",
          )}
        >
          {completed ? (
            <Check className="h-5 w-5 bb-pop" strokeWidth={2.6} />
          ) : (
            <ArrowRight className="h-5 w-5" strokeWidth={2.3} />
          )}
        </div>
      </div>
    );
  },
);
