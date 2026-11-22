import { Award, ShieldCheck } from "lucide-react";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import type { PublicGuestOfWeek } from "@/lib/loyalty";

export interface GuestOfTheWeekProps {
  availability: FeatureAvailabilityStatus;
  winner?: PublicGuestOfWeek | null;
  canWithdraw?: boolean;
  withdrawing?: boolean;
  onWithdraw?: () => void;
}

/**
 * Guest of the Week subsection inside Butcher Block Rewards.
 * Displays an approved, consented winner only when genuine backend data exists.
 * Never fabricates a customer name, photograph, or recognition consent.
 */
export function GuestOfTheWeek({
  availability,
  winner = null,
  canWithdraw = false,
  withdrawing = false,
  onWithdraw,
}: GuestOfTheWeekProps) {
  return (
    <div aria-labelledby="gotw-subsection-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          <h3 id="gotw-subsection-heading" className="text-[15px] font-bold text-white">
            Guest of the Week
          </h3>
        </div>
        {winner && (
          <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[11px] font-semibold text-[#A3A3A3]">
            Week of {winner.week_start}
          </span>
        )}
      </div>

      {availability === "available" && winner ? (
        <div className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4">
          <div className="flex items-start gap-3.5">
            {winner.approved_photo_url && (
              <img
                src={winner.approved_photo_url}
                alt={winner.approved_display_name}
                className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold text-white">{winner.approved_display_name}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#C4C4C4]">{winner.recognition_message}</p>
              {winner.reward_title && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-semibold text-[#FF5A1F]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Approved reward: {winner.reward_title}
                </p>
              )}
            </div>
          </div>

          {canWithdraw && onWithdraw && (
            <button
              type="button"
              disabled={withdrawing}
              onClick={onWithdraw}
              className="mt-4 min-h-[40px] text-[13px] font-semibold text-[#A3A3A3] underline-offset-4 hover:text-white hover:underline"
            >
              Withdraw my public recognition
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4">
          <p className="text-[14px] leading-relaxed text-[#A3A3A3]">
            An optional weekly recognition program celebrating Butcher Block regulars with approved restaurant perks. Guests are only featured with their explicit permission once the program launches.
          </p>
        </div>
      )}
    </div>
  );
}
