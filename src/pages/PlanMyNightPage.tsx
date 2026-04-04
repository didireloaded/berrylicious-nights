import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Sparkles, CalendarCheck } from "lucide-react";

type Step = 1 | 2 | 3;
type Vibe = "chill" | "lively" | "romantic";

const vibeOptions = [
  { value: "chill" as Vibe, emoji: "😌", label: "Chill" },
  { value: "lively" as Vibe, emoji: "🔥", label: "Lively" },
  { value: "romantic" as Vibe, emoji: "🕯️", label: "Romantic" },
];

const suggestions: Record<Vibe, { time: string; dish: string; drink: string }> = {
  chill: { time: "18:00", dish: "Classic Smash Burger + Loaded Fries", drink: "House lager" },
  lively: { time: "20:00", dish: "Lamb Chops + Chicken Wings", drink: "Berry Bliss Cocktail" },
  romantic: { time: "19:30", dish: "Ribeye Steak + Chocolate Lava Cake", drink: "Old Fashioned" },
};

const PlanMyNightPage = () => {
  const [step, setStep] = useState<Step>(1);
  const [guests, setGuests] = useState(2);
  const [vibe, setVibe] = useState<Vibe | null>(null);

  const result = vibe ? suggestions[vibe] : null;

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-6 h-6 text-primary" />
        <h1 className="font-display text-3xl font-bold">Plan My Night</h1>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      {/* Step 1: Guests */}
      {step === 1 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-6">How many people?</h2>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setGuests(n);
                  setStep(2);
                }}
                className={`py-6 rounded-lg text-2xl font-bold border transition-all active:scale-95 ${
                  guests === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-primary/40"
                }`}
              >
                {n === 4 ? "4+" : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Vibe */}
      {step === 2 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-6">What's your vibe?</h2>
          <div className="grid grid-cols-3 gap-3">
            {vibeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setVibe(opt.value);
                  setStep(3);
                }}
                className="bg-card border border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-primary/40 transition-all active:scale-95"
              >
                <span className="text-3xl">{opt.emoji}</span>
                <span className="text-foreground font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-muted-foreground text-sm mt-4 hover:text-foreground transition-colors">
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold mb-2">Here's your night 🍸</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Curated for {guests} guest{guests > 1 ? "s" : ""}, {vibe} vibe
          </p>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-lg">⏰</span>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Best time</p>
                <p className="text-foreground font-semibold">{result.time}</p>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-start gap-3">
              <span className="text-lg">🍽️</span>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">We suggest</p>
                <p className="text-foreground font-semibold">{result.dish}</p>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-start gap-3">
              <span className="text-lg">🍸</span>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Drinks</p>
                <p className="text-foreground font-semibold">{result.drink}</p>
              </div>
            </div>
          </div>

          <Link
            to="/booking"
            className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-lg text-center block hover:opacity-90 transition-opacity active:scale-[0.97]"
          >
            <CalendarCheck className="w-5 h-5 inline mr-2" />
            Book & Pre-Order — one tap
          </Link>

          <button onClick={() => { setStep(1); setVibe(null); }} className="w-full text-muted-foreground text-sm mt-4 hover:text-foreground transition-colors">
            Start over
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanMyNightPage;
