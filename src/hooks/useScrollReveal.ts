import { useEffect, useRef } from "react";

/**
 * Lightweight scroll-reveal: adds `.revealed` when the element enters the viewport.
 * Pair with CSS classes `.scroll-reveal` (initial hidden state) and `.revealed` (visible state).
 *
 * Usage:
 *   const ref = useScrollReveal<HTMLDivElement>();
 *   <div ref={ref} className="scroll-reveal">…</div>
 */
export function useScrollReveal<T extends HTMLElement>(
  threshold = 0.15,
  rootMargin = "0px 0px -40px 0px",
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip if user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("revealed");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}

/**
 * Batch scroll-reveal for multiple children inside a container.
 * Each direct child with `.scroll-reveal` gets staggered `.revealed`.
 */
export function useScrollRevealContainer<T extends HTMLElement>(
  threshold = 0.1,
  staggerMs = 60,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const children = container.querySelectorAll<HTMLElement>(".scroll-reveal");
    if (children.length === 0) return;

    if (prefersReduced) {
      children.forEach((c) => c.classList.add("revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const idx = Array.from(children).indexOf(el);
            setTimeout(() => el.classList.add("revealed"), idx * staggerMs);
            observer.unobserve(el);
          }
        });
      },
      { threshold },
    );

    children.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [threshold, staggerMs]);

  return ref;
}
