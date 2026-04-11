import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import {
  Sparkles,
  CalendarCheck,
  User,
  Heart,
  Users,
  UsersRound,
  Moon,
  Music,
  Zap,
  PartyPopper,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { loadOrderSnapshotFromStorage } from "@/lib/orderTrackingStorage";
import { persistSuggestedNight } from "@/lib/suggestedNight";
import {
  generatePlan,
  type PlanPeople,
  type PlanVibe,
} from "@/lib/planMyNight";
import { executePlanBookAndOrder } from "@/services/planCheckout";
import { clearPlanDraft, readPlanDraft, writePlanDraft } from "@/lib/planDraft";
import { HostYourEventTab } from "@/components/HostYourEventTab";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const peopleOptions: {
  value: PlanPeople;
  label: string;
  guests: number;
  icon: typeof User;
}[] = [
  { value: "just_me", label: "Just me", guests: 1, icon: User },
  { value: "date", label: "Date", guests: 2, icon: Heart },
  { value: "friends", label: "Friends", guests: 4, icon: Users },
  { value: "group", label: "Group", guests: 8, icon: UsersRound },
];

const vibeOptions: {
  value: PlanVibe;
  label: string;
  icon: typeof Moon;
}[] = [
  { value: "chill", label: "Chill", icon: Moon },
  { value: "date_night", label: "Date night", icon: Heart },
  { value: "party", label: "Party", icon: Music },
  { value: "quick_bite", label: "Quick bite", icon: Zap },
];

const timeOptions: { time: string; label: string }[] = [
  { time: "18:00", label: "Quiet evening" },
  { time: "19:30", label: "Best time" },
  { time: "21:00", label: "Peak night" },
];

const stepCopy: Record<1 | 2, { title: string; subtitle: string }> = {
  1: {
    title: "You & the vibe",
    subtitle: "Who’s joining and the energy — two picks, then we lock your time.",
  },
  2: {
    title: "What time works?",
    subtitle: "We’ll line up the kitchen and your table for this arrival window.",
  },
};

/** Clears bottom nav; when cart bar is visible, sit above it (matches CartBar offset + bar height). */
function stickyFooterBottom(cartItemCount: number) {
  if (cartItemCount > 0) {
    return "calc(4.25rem + 3.75rem + env(safe-area-inset-bottom, 0px))";
  }
  return "calc(3.75rem + env(safe-area-inset-bottom, 0px))";
}

function contentPadBottom(cartItemCount: number) {
  if (cartItemCount > 0) {
    return "calc(11.5rem + env(safe-area-inset-bottom, 0px))";
  }
  return "calc(9rem + env(safe-area-inset-bottom, 0px))";
}

function eventsTabPadBottom() {
  return "calc(6.5rem + env(safe-area-inset-bottom, 0px))";
}

function optionCardClass(selected: boolean) {
  return [
    "w-full rounded-2xl border px-5 py-[18px] text-left transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    "btn-press",
    selected
      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15"
      : "border-border bg-card text-foreground hover:border-primary/30",
  ].join(" ");
}

type PlanLocationState = {
  hostPlan?: { people: PlanPeople; vibe: PlanVibe; preferredTime: string };
};

const PlanMyNightPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get("tab") === "events" ? "events" : "plan";
  const setSegment = (s: "plan" | "events") => {
    if (s === "events") setSearchParams({ tab: "events" });
    else setSearchParams({});
  };
  const { addItem, totalItems, clearCart } = useCart();
  const { user, profile, refreshProfile } = useAuth();
  const { setCurrentOrder } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [people, setPeople] = useState<PlanPeople | null>(null);
  const [vibe, setVibe] = useState<PlanVibe | null>(null);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    const hostPlan = (location.state as PlanLocationState | null)?.hostPlan;
    if (!hostPlan) return;
    setPeople(hostPlan.people);
    setVibe(hostPlan.vibe);
    setPreferredTime(hostPlan.preferredTime);
    setStep(3);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (draftHydrated) return;
    const hostPlan = (location.state as PlanLocationState | null)?.hostPlan;
    if (hostPlan) {
      setDraftHydrated(true);
      return;
    }
    const d = readPlanDraft();
    if (d) {
      if (d.people) setPeople(d.people);
      if (d.vibe) setVibe(d.vibe);
      if (d.preferredTime) setPreferredTime(d.preferredTime);
      setStep(d.step);
    }
    setDraftHydrated(true);
  }, [draftHydrated, location.state]);

  useEffect(() => {
    if (step >= 3) {
      clearPlanDraft();
      return;
    }
    writePlanDraft({ step: step as 1 | 2, people, vibe, preferredTime });
  }, [step, people, vibe, preferredTime]);

  const guestCount =
    people != null ? peopleOptions.find((p) => p.value === people)?.guests ?? 2 : 2;

  const plan = useMemo(() => {
    if (!people || !vibe || !preferredTime) return null;
    return generatePlan(people, vibe, preferredTime, guestCount);
  }, [people, vibe, preferredTime, guestCount]);

  useEffect(() => {
    if (step !== 3 || !plan) return;
    const drinkSummary =
      plan.drinkCount > 1 ? `${plan.drinkCount}× ${plan.drink.name}` : plan.drink.name;
    persistSuggestedNight({
      time: plan.time,
      food: plan.food.name,
      drink: drinkSummary,
      guests: guestCount,
    });
  }, [step, plan, guestCount]);

  const canNext =
    (step === 1 && people != null && vibe != null) || (step === 2 && preferredTime != null);

  const goNext = () => {
    if (step === 1 && people && vibe) setStep(2);
    else if (step === 2 && preferredTime) setStep(3);
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const reset = () => {
    clearPlanDraft();
    setStep(1);
    setPeople(null);
    setVibe(null);
    setPreferredTime(null);
  };

  const handleBookAndPreorder = async () => {
    if (!plan || submitting) return;
    setSubmitting(true);
    try {
      addItem(plan.food);
      for (const extra of plan.extras) addItem(extra);
      for (let i = 0; i < plan.drinkCount; i++) addItem(plan.drink);

      const orderId = await executePlanBookAndOrder({
        plan,
        guestCount,
        userId: user?.id ?? null,
        guestName: profile?.display_name ?? null,
      });

      const snap = loadOrderSnapshotFromStorage(orderId);
      setCurrentOrder(
        snap
          ? { ...snap, id: orderId }
          : {
              id: orderId,
              items: [],
              total: 0,
              status: "pending",
            },
      );

      clearPlanDraft();
      clearCart();
      await refreshProfile();
      navigate(`/order/${orderId}`);
    } catch {
      toast.error("Couldn’t place your order. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const contentBottomPad =
    segment === "events" ? eventsTabPadBottom() : contentPadBottom(totalItems);

  return (
    <div className="relative min-h-screen max-w-lg mx-auto px-6 pt-6">
      <div className="pb-8" style={{ paddingBottom: contentBottomPad }}>
        <div className="mb-5 flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">Plan &amp; host</span>
        </div>

        <div className="mb-6 flex rounded-2xl border border-border bg-muted/25 p-1">
          <button
            type="button"
            onClick={() => setSegment("plan")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors",
              segment === "plan" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Plan
          </button>
          <button
            type="button"
            onClick={() => setSegment("events")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors",
              segment === "events" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            <PartyPopper className="h-4 w-4 shrink-0 text-primary" />
            Host
          </button>
        </div>

        {segment === "events" && <HostYourEventTab />}

        {segment === "plan" && (
          <>
        <div
          className="mb-8 flex gap-2"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                s <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        {step < 3 && (
          <header className="mb-8 animate-plan-step-in">
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground md:text-[26px]">
              {stepCopy[step].title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {stepCopy[step].subtitle}
            </p>
          </header>
        )}

        {step === 1 && (
          <div key="step-1" className="animate-plan-step-in space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Who’s joining?</p>
              <div className="space-y-3">
                {peopleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = people === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPeople(opt.value)}
                      className={optionCardClass(selected)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            selected ? "bg-primary-foreground/15" : "bg-primary/10"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${selected ? "text-primary-foreground" : "text-primary"}`} />
                        </div>
                        <span className={`text-base font-semibold ${selected ? "text-primary-foreground" : ""}`}>
                          {opt.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Set the vibe</p>
              <div className="grid grid-cols-2 gap-3">
                {vibeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = vibe === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVibe(opt.value)}
                      className={[
                        "flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-2xl border p-3 text-center transition-colors duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 btn-press",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15"
                          : "border-border bg-card text-foreground hover:border-primary/30",
                      ].join(" ")}
                    >
                      <Icon className={`h-6 w-6 ${selected ? "text-primary-foreground" : "text-primary"}`} />
                      <span className={`text-sm font-semibold ${selected ? "text-primary-foreground" : ""}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div key="step-2" className="animate-plan-step-in space-y-3">
            {timeOptions.map((slot) => {
              const selected = preferredTime === slot.time;
              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setPreferredTime(slot.time)}
                  className={optionCardClass(selected)}
                >
                  <span className={`text-base font-semibold ${selected ? "text-primary-foreground" : "text-foreground"}`}>
                    {slot.time}
                  </span>
                  <span className={selected ? "text-primary-foreground/85" : "text-muted-foreground"}>
                    {" "}
                    · {slot.label}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={goBack}
              className="mt-8 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {step === 3 && plan && (
          <div key="step-3" className="animate-plan-result-in">
            <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
              Tonight is sorted
            </h1>
            <p className="mt-4 font-display text-3xl font-bold text-primary">{plan.time}</p>
            <p className="mt-4 text-lg font-semibold text-foreground leading-snug">
              {plan.food.name}
              {plan.drinkCount > 1 ? ` and ${plan.drinkCount}× ${plan.drink.name}` : ` and ${plan.drink.name}`}
            </p>
            {plan.extras.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">+ {plan.extras.map((e) => e.name).join(", ")}</p>
            )}
            <p className="mt-4 text-base font-bold text-primary">Table ready</p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{plan.note}</p>

            <button
              type="button"
              onClick={reset}
              className="mt-10 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Start over
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Sticky footer — above bottom nav (plan flow only) */}
      {segment === "plan" && (
      <div
        className="fixed left-0 right-0 z-[45] border-t border-border bg-background/95 px-6 py-4 backdrop-blur-lg"
        style={{ bottom: stickyFooterBottom(totalItems) }}
      >
        <div className="mx-auto max-w-lg">
          {step <= 2 && (
            <button
              type="button"
              disabled={!canNext}
              onClick={goNext}
              className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-center text-sm font-bold text-primary-foreground btn-press disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          )}
          {step === 3 && plan && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleBookAndPreorder()}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary py-4 text-center text-sm font-bold text-primary-foreground btn-press shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <CalendarCheck className="h-5 w-5 shrink-0" />
              {submitting ? "Placing order…" : "Book and pre-order"}
            </button>
          )}
        </div>
      </div>
      )}

    </div>
  );
};

export default PlanMyNightPage;
