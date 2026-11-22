import type { ReactNode } from "react";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

export interface OnboardingSlideProps {
  image: string;
  imagePosition?: string;
  showTopLogo?: boolean;
  headline: string;
  supportingText: string;
  visualAccent?: ReactNode;
  active: boolean;
}

export function OnboardingSlide({
  image,
  imagePosition = "object-center",
  showTopLogo = false,
  headline,
  supportingText,
  visualAccent,
  active,
}: OnboardingSlideProps) {
  return (
    <div
      aria-hidden={!active}
      className="relative isolate flex min-h-dvh w-full shrink-0 flex-col justify-between overflow-hidden bg-[#0A0A0A] text-white"
    >
      {/* Full-bleed authentic Butcher Block photography */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={
            `h-full w-full object-cover ${imagePosition} transition-transform duration-700 bb-ease-spring motion-reduce:transition-none ` +
            (active ? "scale-100" : "scale-[1.04]")
          }
        />
      </div>

      {/* Controlled readability scrims — keeps photography dominant and luminous */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[34%] bg-gradient-to-b from-[#0A0A0A]/80 via-[#0A0A0A]/35 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[62%] bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 via-[48%] to-transparent"
      />

      {/* Top Logo Area */}
      <div className="relative z-20 mx-auto flex w-full max-w-[520px] flex-col items-center px-6 pt-[max(54px,calc(env(safe-area-inset-top,0px)+34px))] text-center">
        {showTopLogo ? (
          <div
            className={
              "transition-all duration-500 bb-ease-spring motion-reduce:transition-none " +
              (active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")
            }
          >
            <img
              src={butcherBlockLogo}
              alt="Butcher Block Steakhouse"
              className="mx-auto w-[196px] max-w-[56vw] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:w-[224px]"
            />
            <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
              Am Weinberg Estate · Windhoek
            </p>
          </div>
        ) : (
          <img
            src={butcherBlockLogo}
            alt="Butcher Block Steakhouse"
            className="mx-auto h-7 w-auto object-contain opacity-95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
          />
        )}
      </div>

      {/* Bottom Editorial Copy Block (positioned cleanly above persistent CTA chrome) */}
      <div className="relative z-20 mx-auto w-full max-w-[460px] px-6 pb-[262px] sm:pb-[272px]">
        {visualAccent && (
          <div
            className={
              "mb-5 transition-all duration-500 bb-ease-spring motion-reduce:transition-none " +
              (active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")
            }
          >
            {visualAccent}
          </div>
        )}

        <h1
          className={
            "font-display text-[clamp(2.15rem,9vw,2.85rem)] font-extrabold leading-[1.06] tracking-[-0.045em] text-white transition-all duration-500 bb-ease-spring motion-reduce:transition-none " +
            (active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")
          }
        >
          {headline}
        </h1>
        <p
          className={
            "mt-3 max-w-[36ch] text-[16px] font-normal leading-relaxed text-[#D4D4D4] transition-all delay-75 duration-500 bb-ease-spring motion-reduce:transition-none " +
            (active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")
          }
        >
          {supportingText}
        </p>
      </div>
    </div>
  );
}
