import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ShoppingBag, Wine } from "lucide-react";
import heroFood from "@/assets/dish-burger.jpg";
import detailFood from "@/assets/dish-lamb.jpg";
import cocktail from "@/assets/dish-cocktail.jpg";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";
import { useApp } from "@/context/AppContext";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

const SMOOTH_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const MOTION_SAFE = "motion-reduce:transition-none";

function revealStyle(delayMs: number, durationMs = 700): CSSProperties {
  return {
    transitionDelay: `${delayMs}ms`,
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: SMOOTH_EASE,
  };
}

export default function HomePageEditorial() {
  const [entered, setEntered] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);
  const { currentOrder, currentBooking } = useApp();
  const { openAbout } = useAboutSheet();
  const hasOrder = Boolean(currentOrder && ["pending", "preparing", "ready"].includes(String(currentOrder.status)));
  const hasBooking = Boolean(currentBooking && currentBooking.date >= getWindhoekDateISO());
  const statusLink = useMemo(() => {
    if (hasOrder && currentOrder) return { to: `/order/${currentOrder.id}`, label: "Track your order", state: undefined };
    if (hasBooking && currentBooking) return { to: "/booking/success", label: "View your reservation", state: currentBooking };
    return null;
  }, [hasOrder, hasBooking, currentOrder, currentBooking]);

  useEffect(() => {
    if (!entered) return;
    const timer = window.setTimeout(() => setSplashMounted(false), 820);
    return () => window.clearTimeout(timer);
  }, [entered]);

  return (
    <div
      className={
        "mx-auto max-w-[560px] bg-[#121212] text-white " +
        (entered ? "min-h-dvh" : "h-dvh overflow-hidden")
      }
    >
      {/* Pure-black logo launch curtain that dissolves smoothly on tap */}
      {splashMounted && (
        <div
          aria-hidden={entered}
          style={revealStyle(0, 720)}
          className={
            `fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center bg-black px-8 text-white transition-opacity ${MOTION_SAFE} ` +
            (entered ? "pointer-events-none opacity-0" : "opacity-100")
          }
        >
          <button
            type="button"
            disabled={entered}
            onClick={() => setEntered(true)}
            aria-label="Enter Butcher Block Steakhouse"
            style={revealStyle(0, 560)}
            className={
              `group flex flex-col items-center justify-center gap-7 rounded-3xl p-8 transition-all ${MOTION_SAFE} hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] ` +
              (entered ? "-translate-y-7 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100")
            }
          >
            <img
              src={butcherBlockLogo}
              alt="Butcher Block Steakhouse"
              className="w-[240px] max-w-[72vw] object-contain"
            />
            <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-white/40 transition-colors group-hover:text-white/75">
              Tap to enter
            </span>
          </button>
        </div>
      )}

      {/* Hero screen with choreographed staggered entrance */}
      <section
        aria-hidden={!entered}
        className="relative isolate h-[100dvh] min-h-[640px] overflow-hidden bg-black"
      >
        <img
          src={heroFood}
          alt="Butcher Block signature burger"
          decoding="async"
          style={revealStyle(40, 1050)}
          className={
            `absolute inset-0 -z-20 h-full w-full object-cover object-[50%_25%] transition-all ${MOTION_SAFE} ` +
            (entered ? "scale-100 opacity-100" : "scale-110 opacity-0")
          }
        />
        <div
          style={revealStyle(0, 800)}
          className={
            `absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/10 via-[34%] to-black/90 transition-opacity ${MOTION_SAFE} ` +
            (entered ? "opacity-100" : "opacity-0")
          }
          aria-hidden="true"
        />
        <div
          style={revealStyle(0, 800)}
          className={
            `absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-transparent to-transparent transition-opacity ${MOTION_SAFE} ` +
            (entered ? "opacity-100" : "opacity-0")
          }
          aria-hidden="true"
        />

        <header
          style={revealStyle(200, 720)}
          className={
            `absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 pt-[max(30px,env(safe-area-inset-top,0px))] transition-all ${MOTION_SAFE} sm:px-7 ` +
            (entered ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0")
          }
        >
          <Link
            to="/home"
            tabIndex={entered ? 0 : -1}
            aria-label="Butcher Block Steakhouse home"
            className="font-display text-[19px] font-extrabold tracking-[-0.055em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="h-9 w-auto object-contain" />
          </Link>
        </header>

        <div className="absolute inset-x-0 bottom-[166px] z-10 px-5 sm:px-7">
          <h1 className="max-w-[510px] font-display text-[clamp(3.15rem,12.5vw,5.25rem)] font-extrabold leading-[0.95] tracking-[-0.075em] text-white">
            <span
              style={revealStyle(260, 740)}
              className={
                `block transition-all ${MOTION_SAFE} ` +
                (entered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
              }
            >
              Come
            </span>
            <span
              style={revealStyle(360, 740)}
              className={
                `flex items-center gap-[0.13em] whitespace-nowrap transition-all ${MOTION_SAFE} ` +
                (entered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
              }
            >
              hungry.
              <span
                style={revealStyle(520, 680)}
                className={
                  `relative inline-block h-[0.49em] w-[1.36em] shrink-0 overflow-hidden rounded-full border-2 border-white/60 bg-black/60 align-middle transition-all ${MOTION_SAFE} ` +
                  (entered ? "scale-100 opacity-100" : "scale-75 opacity-0")
                }
              >
                <img src={detailFood} alt="" className="h-full w-full object-cover" aria-hidden="true" />
              </span>
            </span>
            <span
              style={revealStyle(460, 740)}
              className={
                `block transition-all ${MOTION_SAFE} ` +
                (entered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
              }
            >
              Stay for
            </span>
            <span
              style={revealStyle(560, 740)}
              className={
                `flex items-center gap-[0.14em] whitespace-nowrap transition-all ${MOTION_SAFE} ` +
                (entered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
              }
            >
              more.
              <span
                style={revealStyle(700, 680)}
                className={
                  `relative inline-block h-[0.49em] w-[1.4em] shrink-0 overflow-hidden rounded-full border-2 border-white/60 bg-black/60 align-middle transition-all ${MOTION_SAFE} ` +
                  (entered ? "scale-100 opacity-100" : "scale-75 opacity-0")
                }
              >
                <img src={cocktail} alt="" className="h-full w-full object-cover" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p
            style={revealStyle(700, 740)}
            className={
              `mt-5 max-w-[260px] text-[14px] leading-relaxed text-white/75 transition-all ${MOTION_SAFE} ` +
              (entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0")
            }
          >
            Good food. Good company. The rest is up to you.
          </p>
        </div>

        <div
          style={revealStyle(800, 720)}
          className={
            `absolute bottom-6 left-5 z-20 max-w-[190px] transition-all ${MOTION_SAFE} sm:left-7 ` +
            (entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0")
          }
        >
          <span className="block text-sm font-semibold">Explore the menu</span>
        </div>
        <div
          style={revealStyle(780, 780)}
          className={
            `absolute -bottom-3 -right-3 z-20 h-[156px] w-[156px] rounded-tl-[110px] bg-white p-[12px] transition-all ${MOTION_SAFE} ` +
            (entered ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-12 translate-y-12 opacity-0")
          }
        >
          <Link
            to="/home"
            tabIndex={entered ? 0 : -1}
            aria-label="Enter Butcher Block Steakhouse"
            className="flex h-full w-full items-center justify-center rounded-tl-[98px] bg-[#ff5a1f] text-white transition-colors duration-200 hover:bg-[#fa703f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
          >
            <ArrowRight className="ml-6 mt-7 h-9 w-9 transition-transform duration-200" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {entered && (
        <div className="animate-fade-in">
          {statusLink && (
            <Link
              to={statusLink.to}
              state={statusLink.state}
              className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#202020] px-6 py-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              {statusLink.label} <ArrowRight className="h-5 w-5 text-[#ff5a1f]" />
            </Link>
          )}

          <section className="px-6 py-16 sm:px-8" aria-labelledby="night-heading">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff794c]">MORE THAN A MEAL</p>
            <h2 id="night-heading" className="mt-3 max-w-sm text-[38px] font-extrabold leading-[1.05] tracking-[-0.06em]">Make an evening of it.</h2>
            <div className="mt-9 divide-y divide-white/10 border-y border-white/10">
              <Link to="/booking" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                <span><span className="block text-lg font-semibold">Reserve a table</span><span className="mt-1 block text-sm text-white/50">Choose your date and time.</span></span><CalendarDays className="h-6 w-6 shrink-0" strokeWidth={1.6} />
              </Link>
              <Link to="/drinks" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                <span><span className="block text-lg font-semibold">Wine &amp; Drinks</span><span className="mt-1 block text-sm text-white/50">South African cellar, cocktails &amp; jars.</span></span><Wine className="h-6 w-6 shrink-0" strokeWidth={1.6} />
              </Link>
              <Link to="/cart" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                <span><span className="block text-lg font-semibold">Your order</span><span className="mt-1 block text-sm text-white/50">See what is in your bag.</span></span><ShoppingBag className="h-6 w-6 shrink-0" strokeWidth={1.6} />
              </Link>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-8 text-[13px] text-white/55 sm:px-8">
            <span>Butcher Block Steakhouse · Am Weinberg Estate, Windhoek</span>
            <button type="button" onClick={openAbout} className="text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">About &amp; contact</button>
          </footer>
        </div>
      )}
    </div>
  );
}
