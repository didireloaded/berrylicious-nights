import { useState } from "react";
import { Bookmark, Check, Flame, RotateCcw, Trash2 } from "lucide-react";
import { useDiningPreferences } from "@/hooks/useDiningPreferences";
import { DIETARY_PREFERENCE_OPTIONS } from "@/lib/smartSuggestions";
import { PDF_COMPLIMENTARY_SIDES, PDF_DONENESS_GUIDE } from "@/data/menu";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import { cn } from "@/lib/utils";

export function MyUsualSection() {
  const { prefs, toggleDietaryPreference, setSteakDefaults, removeUsualItem } = useDiningPreferences();
  const [previewOpen, setPreviewOpen] = useState(false);

  const usualAsOrderLines = prefs.usualItems.map((u) => ({
    id: u.menuItemId,
    name: u.name,
    qty: u.quantity,
    weight: u.weight,
    doneness: u.doneness,
    side: u.side,
    sauces: u.sauces,
  }));

  return (
    <section className="space-y-4" aria-labelledby="my-usual-heading">
      {/* Saved Usual Order Card */}
      <div className="rounded-[24px] border border-white/10 bg-[#242424] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="my-usual-heading" className="text-[16px] font-bold text-white">
                My Usual Order
              </h2>
              <p className="text-[13px] text-[#A3A3A3]">
                Save your favourite cuts, steak cook, and sides for faster ordering.
              </p>
            </div>
          </div>
        </div>

        {prefs.usualItems.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[13px] text-[#A3A3A3]">
            Open any dish or steak on the menu, choose your exact cook and side, and tap &ldquo;Save to My Usual&rdquo; to keep it ready here.
          </p>
        ) : (
          <div className="space-y-2.5">
            {prefs.usualItems.map((u) => {
              const mods = [
                u.weight,
                u.doneness,
                u.side ? `Side: ${u.side}` : null,
                u.sauces?.length ? `+${u.sauces.join(", ")}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={u.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-white">
                      {u.quantity}× {u.name}
                    </p>
                    {mods && <p className="mt-0.5 text-[12px] text-[#A3A3A3]">{mods}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUsualItem(u.key)}
                    aria-label={`Remove ${u.name} from My Usual`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#A3A3A3] hover:bg-[#303030] hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Order My Usual (Check Live Prices)
            </button>
          </div>
        )}

        {/* Default Steak Preferences */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
            <Flame className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Default Steak Preferences
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-doneness" className="mb-1 block text-[12px] text-[#A3A3A3]">
                Preferred doneness
              </label>
              <select
                id="pref-doneness"
                value={prefs.preferredDoneness}
                onChange={(e) => setSteakDefaults(e.target.value, prefs.preferredSide)}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#181818] px-3 text-[14px] text-white"
              >
                {PDF_DONENESS_GUIDE.map((d) => (
                  <option key={d.label} value={d.label}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pref-side" className="mb-1 block text-[12px] text-[#A3A3A3]">
                Preferred included side
              </label>
              <select
                id="pref-side"
                value={prefs.preferredSide}
                onChange={(e) => setSteakDefaults(prefs.preferredDoneness, e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#181818] px-3 text-[14px] text-white"
              >
                {PDF_COMPLIMENTARY_SIDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dietary Preferences (Drives Smart Suggestions) */}
        <div className="border-t border-white/10 pt-4 space-y-2.5">
          <p className="text-[13px] font-bold text-white">Dietary &amp; Taste Preferences</p>
          <p className="text-[12px] text-[#A3A3A3]">
            Used to personalize menu suggestions. Always confirm severe allergies directly with staff.
          </p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_PREFERENCE_OPTIONS.map((opt) => {
              const active = prefs.dietaryPreferences.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDietaryPreference(opt.id)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors",
                    active
                      ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                      : "border-white/10 bg-[#181818] text-[#A3A3A3] hover:text-white",
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ReorderPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        orderNumber="USUAL"
        orderItems={usualAsOrderLines}
      />
    </section>
  );
}
