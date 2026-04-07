import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Sparkles } from "lucide-react";
import { generatePlan, type PlanPeople, type PlanVibe } from "@/lib/planMyNight";
import {
  ENERGY_CHIPS,
  guestCountForPeople,
  MOOD_CHIPS,
  resolvePeopleVibe,
  TIME_CHIPS,
  type HostMoodId,
} from "@/lib/conciergeHostFlow";
import { cn } from "@/lib/utils";

const TYPING_MS = 640;
const STAGGER_MS = 380;

export type HostPlanHandoff = {
  people: PlanPeople;
  vibe: PlanVibe;
  preferredTime: string;
  guestCount: number;
  plan: ReturnType<typeof generatePlan>;
};

type ChatLine =
  | { id: string; role: "host"; text: string }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "host_plan"; plan: ReturnType<typeof generatePlan>; guestCount: number };

type Phase = "boot" | "mood" | "energy" | "time" | "plan";

type ChipOption = { key: string; label: string };

type ConciergeCtx = {
  lines: ChatLine[];
  hostTyping: boolean;
  chips: ChipOption[] | null;
  onChip: (key: string) => void;
  phase: Phase;
  handoff: HostPlanHandoff | null;
  onBookPlan: () => void;
  onResetFlow: () => void;
};

const ConciergeContext = createContext<ConciergeCtx | null>(null);

function useConcierge() {
  const c = useContext(ConciergeContext);
  if (!c) throw new Error("Berrylicious host components require BerryliciousHostProvider");
  return c;
}

function lineId() {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ProviderProps = {
  children: ReactNode;
  onBookPlan: (handoff: HostPlanHandoff) => void;
};

export function BerryliciousHostProvider({ children, onBookPlan }: ProviderProps) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [hostTyping, setHostTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>("boot");
  const [mood, setMood] = useState<HostMoodId | null>(null);
  const [peopleVibe, setPeopleVibe] = useState<{ people: PlanPeople; vibe: PlanVibe } | null>(null);
  const [handoff, setHandoff] = useState<HostPlanHandoff | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const pushHost = useCallback((text: string) => {
    setLines((prev) => [...prev, { id: lineId(), role: "host", text }]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setLines((prev) => [...prev, { id: lineId(), role: "user", text }]);
  }, []);

  const runHostMessage = useCallback(
    (text: string, after?: () => void) => {
      setHostTyping(true);
      schedule(() => {
        setHostTyping(false);
        pushHost(text);
        after?.();
      }, TYPING_MS);
    },
    [pushHost, schedule],
  );

  const seedOpening = useRef(false);
  useEffect(() => {
    if (seedOpening.current) return;
    seedOpening.current = true;
    runHostMessage("What are you feeling tonight?", () => setPhase("mood"));
  }, [runHostMessage]);

  const chips: ChipOption[] | null = useMemo(() => {
    if (hostTyping) return null;
    switch (phase) {
      case "boot":
      case "plan":
        return null;
      case "mood":
        return MOOD_CHIPS.map((c) => ({ key: c.id, label: c.label }));
      case "energy":
        return ENERGY_CHIPS.map((c) => ({ key: c.id, label: c.label }));
      case "time":
        return TIME_CHIPS.map((c) => ({ key: c.time, label: c.label }));
    }
  }, [phase, hostTyping]);

  const finalizePlan = useCallback(
    (time: string, pv: { people: PlanPeople; vibe: PlanVibe }) => {
      const guestCount = guestCountForPeople(pv.people);
      const plan = generatePlan(pv.people, pv.vibe, time, guestCount);
      setHandoff({
        people: pv.people,
        vibe: pv.vibe,
        preferredTime: time,
        guestCount,
        plan,
      });
      setPhase("plan");
      runHostMessage("I’ve got a perfect setup for you.", () => {
        schedule(() => {
          setLines((prev) => [
            ...prev,
            { id: lineId(), role: "host_plan", plan, guestCount },
          ]);
        }, STAGGER_MS);
      });
    },
    [runHostMessage, schedule],
  );

  const onChip = useCallback(
    (key: string) => {
      if (hostTyping) return;
      if (phase === "mood") {
        const m = key as HostMoodId;
        setMood(m);
        pushUser(MOOD_CHIPS.find((c) => c.id === m)?.label ?? key);
        runHostMessage("Got it. Something relaxed or more lively?", () => setPhase("energy"));
        return;
      }
      if (phase === "energy" && mood) {
        const energy = key as "relaxed" | "lively";
        pushUser(ENERGY_CHIPS.find((c) => c.id === energy)?.label ?? key);
        const pv = resolvePeopleVibe(mood, energy);
        setPeopleVibe(pv);
        runHostMessage("Love it. What time are you thinking?", () => setPhase("time"));
        return;
      }
      if (phase === "time" && peopleVibe) {
        const slot = TIME_CHIPS.find((c) => c.time === key);
        pushUser(slot?.label ?? key);
        finalizePlan(key, peopleVibe);
      }
    },
    [finalizePlan, hostTyping, mood, peopleVibe, phase, pushUser, runHostMessage],
  );

  const handleBookPlan = useCallback(() => {
    if (!handoff) return;
    onBookPlan(handoff);
  }, [handoff, onBookPlan]);

  const onResetFlow = useCallback(() => {
    clearTimers();
    setHostTyping(false);
    setLines([]);
    setPhase("boot");
    setMood(null);
    setPeopleVibe(null);
    setHandoff(null);
    schedule(() => {
      runHostMessage("What are you feeling tonight?", () => setPhase("mood"));
    }, 120);
  }, [clearTimers, runHostMessage, schedule]);

  const value = useMemo(
    () =>
      ({
        lines,
        hostTyping,
        chips,
        onChip,
        phase,
        handoff,
        onBookPlan: handleBookPlan,
        onResetFlow,
      }) satisfies ConciergeCtx,
    [chips, handoff, handleBookPlan, hostTyping, lines, onChip, onResetFlow, phase],
  );

  return <ConciergeContext.Provider value={value}>{children}</ConciergeContext.Provider>;
}

export function BerryliciousHostThread({ className }: { className?: string }) {
  const { lines, hostTyping } = useConcierge();

  return (
    <div className={cn("space-y-5", className)}>
      {lines.map((line) => {
        if (line.role === "user") {
          return (
            <div key={line.id} className="flex justify-end animate-fade-in">
              <div
                className="max-w-[90%] rounded-2xl rounded-br-md border border-primary/35 bg-primary/12 px-4 py-3.5 text-[15px] leading-relaxed text-white shadow-sm"
                style={{ animationDuration: "280ms" }}
              >
                {line.text}
              </div>
            </div>
          );
        }
        if (line.role === "host") {
          return (
            <div key={line.id} className="flex justify-start animate-fade-in">
              <div
                className="max-w-[92%] rounded-2xl rounded-bl-md bg-[#1a1a1a] px-4 py-3.5 text-[15px] leading-relaxed text-white/95 shadow-inner shadow-black/20"
                style={{ animationDuration: "280ms" }}
              >
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Berrylicious</p>
                <p className="whitespace-pre-wrap">{line.text}</p>
              </div>
            </div>
          );
        }
        const { plan, guestCount } = line;
        const drinkLine =
          plan.drinkCount > 1 ? `${plan.drinkCount}× ${plan.drink.name}` : plan.drink.name;
        return (
          <div key={line.id} className="flex justify-start animate-plan-result-in">
            <div className="w-full max-w-[92%] rounded-2xl rounded-bl-md border border-primary/25 bg-[#141414] px-4 py-4 text-white/95 shadow-lg shadow-black/25">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                <span className="font-display text-sm font-semibold tracking-tight">Tonight’s line-up</span>
              </div>
              <p className="font-display text-lg font-bold text-primary">{plan.time}</p>
              <p className="mt-2 text-[15px] font-medium leading-snug text-white">
                {plan.food.name} · {drinkLine}
              </p>
              {plan.extras.length > 0 && (
                <p className="mt-1.5 text-xs text-white/50">+ {plan.extras.map((e) => e.name).join(", ")}</p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-white/60">{plan.note}</p>
              <p className="mt-2 text-[11px] text-white/40">About {guestCount} guests — tweak on the next screen if needed.</p>
            </div>
          </div>
        );
      })}

      {hostTyping && (
        <div className="flex justify-start animate-fade-in">
          <p className="text-sm text-white/45">Someone is typing…</p>
        </div>
      )}
    </div>
  );
}

export function BerryliciousHostActionChips({ className }: { className?: string }) {
  const { chips, onChip, handoff, onBookPlan, onResetFlow, hostTyping } = useConcierge();

  if (handoff && !hostTyping) {
    return (
      <div className={cn("space-y-3", className)}>
        <button
          type="button"
          onClick={onBookPlan}
          className="w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 btn-press"
        >
          Book this plan
        </button>
        <button
          type="button"
          onClick={onResetFlow}
          className="w-full py-2 text-center text-xs font-medium text-white/45 transition-colors hover:text-white/70"
        >
          Start over
        </button>
      </div>
    );
  }

  if (!chips?.length || hostTyping) {
    return <div className={cn("min-h-[48px]", className)} aria-hidden />;
  }

  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChip(c.key)}
          className="rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-primary/40 hover:bg-[#222] btn-press"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
