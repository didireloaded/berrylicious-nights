import type { ReactNode } from "react";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  showLogo?: boolean;
}

export function AuthHeader({ title, subtitle, icon, showLogo = true }: AuthHeaderProps) {
  return (
    <header className="mb-7">
      {showLogo && (
        <img
          src={butcherBlockLogo}
          alt="Butcher Block Steakhouse"
          className="mb-6 h-8 w-auto object-contain"
        />
      )}
      {icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF5A1F]/25 bg-[#FF5A1F]/15 text-[#FF5A1F]">
          {icon}
        </div>
      )}
      <h1 className="font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-[34px]">
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#A3A3A3]">{subtitle}</p>
    </header>
  );
}
