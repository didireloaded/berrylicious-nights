import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { foodItems } from "@/data/menu";
import { supabase } from "@/integrations/supabase/client";
import {
  consumePendingRedirect,
  markOnboardingCompleted,
  markProfileSetupCompleted,
} from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { AuthTextField } from "./AuthTextField";
import { AuthErrorMessage } from "./AuthErrorMessage";

const SIGNATURE_PICK_IDS = ["cc-ribeye", "cc-fillet", "6", "cc-rump", "cc-sirloin", "cc-tbone"];

interface ProfileSetupProps {
  redirectTo: string;
}

/**
 * Optional quick setup after account creation.
 * Persists ONLY fields supported by live `public.profiles` (`favorite_items` and optional `phone`) —
 * never fakes unbacked preference storage and never blocks access to the app.
 */
export function ProfileSetup({ redirectTo }: ProfileSetupProps) {
  const { user, profile, updateProfileDetails, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const signatureChoices = useMemo(
    () =>
      SIGNATURE_PICK_IDS.map((id) => foodItems.find((item) => item.id === id)).filter(
        (item): item is (typeof foodItems)[number] => item != null,
      ),
    [],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    Array.isArray(profile?.favorite_items) ? profile.favorite_items : [],
  );
  const [phone, setPhone] = useState(() => profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveLockRef = useRef(false);

  const toggleDish = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const finish = () => {
    markOnboardingCompleted();
    markProfileSetupCompleted(user?.id);
    const target = consumePendingRedirect(redirectTo);
    navigate(target, { replace: true });
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    if (!user?.id) {
      finish();
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    setErrorMsg(null);

    try {
      const cleanedPhone = phone.trim();
      const existingName =
        profile?.display_name || String(user.user_metadata?.full_name ?? "").trim();

      if (cleanedPhone) {
        const res = await updateProfileDetails({
          displayName: existingName,
          phone: cleanedPhone,
        });
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
      }

      if (selectedIds.length > 0) {
        const { error: favErr } = await supabase
          .from("profiles")
          .upsert(
            { user_id: user.id, favorite_items: selectedIds },
            { onConflict: "user_id" },
          );
        if (favErr) {
          setErrorMsg("We couldn't save your favourites right now. You can skip and add them anytime.");
          return;
        }
        try {
          localStorage.setItem("butcher-block-favorites", JSON.stringify(selectedIds));
          window.dispatchEvent(new CustomEvent<string[]>("bb-favorites-updated", { detail: selectedIds }));
        } catch {
          /* ignore */
        }
        await refreshProfile();
      }

      toast.success("Preferences saved");
      finish();
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      <AuthHeader
        title="Make It Yours."
        subtitle="Save a few favourites for quick access across devices. You can change these anytime."
      />

      <form onSubmit={handleContinue} className="space-y-6">
        {errorMsg && <AuthErrorMessage message={errorMsg} variant="error" />}

        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-[14px] font-semibold text-white/90">
            <Heart className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Favourite cuts (optional)
          </p>
          <div className="flex flex-wrap gap-2">
            {signatureChoices.map((dish) => {
              const selected = selectedIds.includes(dish.id);
              return (
                <button
                  key={dish.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleDish(dish.id)}
                  className={
                    "bb-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                    (selected
                      ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                      : "border-white/10 bg-[#242424] text-white/90 hover:border-white/25 hover:bg-[#303030]")
                  }
                >
                  {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                  {dish.name}
                </button>
              );
            })}
          </div>
        </div>

        <AuthTextField
          id="setup-phone"
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label="Phone number (optional)"
          placeholder="+264 81 000 0000"
          hint="Used only to pre-fill table reservations and pickup orders."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={saving}
        />

        <div className="space-y-2.5 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bb-press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </button>

          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="bb-press flex min-h-[48px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Maybe Later
          </button>
        </div>
      </form>
    </div>
  );
}
