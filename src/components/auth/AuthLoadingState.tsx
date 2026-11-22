import butcherBlockLogo from "@/assets/butcher-block-logo.png";

interface AuthLoadingStateProps {
  message?: string;
}

export function AuthLoadingState({ message = "Preparing Butcher Block…" }: AuthLoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-[#0A0A0A] px-6 text-center text-white"
    >
      <img
        src={butcherBlockLogo}
        alt="Butcher Block Steakhouse"
        className="w-[180px] max-w-[55vw] object-contain opacity-95"
      />
      <div className="flex items-center gap-3 text-[14px] font-medium text-[#A3A3A3]">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF5A1F] border-t-transparent motion-reduce:animate-none"
        />
        <span>{message}</span>
      </div>
    </div>
  );
}
