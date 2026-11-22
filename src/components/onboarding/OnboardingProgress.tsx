import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  totalSteps: number;
  currentStep: number;
  onSelectStep?: (step: number) => void;
  className?: string;
}

export function OnboardingProgress({
  totalSteps,
  currentStep,
  onSelectStep,
  className,
}: OnboardingProgressProps) {
  return (
    <div
      role="tablist"
      aria-label={`Onboarding progress, step ${currentStep + 1} of ${totalSteps}`}
      className={cn("flex items-center justify-center gap-2", className)}
    >
      {Array.from({ length: totalSteps }).map((_, index) => {
        const active = index === currentStep;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Step ${index + 1} of ${totalSteps}`}
            onClick={() => onSelectStep?.(index)}
            className="flex h-7 items-center justify-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-full"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300 bb-ease-spring motion-reduce:transition-none",
                active ? "w-7 bg-[#FF5A1F]" : "w-1.5 bg-white/30 hover:bg-white/50",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
