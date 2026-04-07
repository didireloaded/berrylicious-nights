import { useMemo, useState } from "react";
import {
  Building2,
  ChefHat,
  Mic2,
  Monitor,
  Camera,
  Flower2,
  Sparkles,
  Users,
  Clock,
  MessageCircle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatPrice } from "@/lib/vibe";
import {
  defaultHostPackage,
  estimateHostEvent,
  HOST_CATERING_LABELS,
  HOST_EVENT_TYPE_LABELS,
  HOST_SPACE_LABELS,
  type HostCatering,
  type HostEventPackage,
  type HostEventType,
  type HostSpace,
} from "@/lib/hostPrivateEvent";
import { cn } from "@/lib/utils";

function ToggleRow({
  active,
  onToggle,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onToggle: () => void;
  icon: typeof Mic2;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors btn-press",
        active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/25",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {active ? "On" : "Off"}
      </span>
    </button>
  );
}

export function HostYourEventTab() {
  const [pkg, setPkg] = useState<HostEventPackage>(() => defaultHostPackage());

  const estimate = useMemo(() => estimateHostEvent(pkg), [pkg]);

  const setGuests = (v: number[]) => setPkg((p) => ({ ...p, guests: v[0] ?? p.guests }));
  const setHours = (v: number[]) => setPkg((p) => ({ ...p, durationHours: v[0] ?? p.durationHours }));

  return (
    <div className="animate-fade-in space-y-8 pb-4">
      <header>
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground">Host at Berrylicious</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Private birthdays, corporate nights, launches, and receptions — build a package and get an instant ballpark.
          Final quotes always come from our events team after a quick brief.
        </p>
      </header>

      {/* Flow mockup */}
      <section className="rounded-2xl border border-border bg-gradient-to-b from-card to-background/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">How it works</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { step: "1", title: "Brief", sub: "Guests & vibe" },
            { step: "2", title: "Package", sub: "Space + F&B" },
            { step: "3", title: "Lock in", sub: "Chat with us" },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-border/80 bg-background/50 px-2 py-3">
              <p className="font-display text-lg font-bold text-primary">{s.step}</p>
              <p className="mt-1 text-[11px] font-semibold text-foreground">{s.title}</p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
        {/* Simple venue mockup */}
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#141414] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">Sample floor flow</p>
          <div className="mt-2 flex gap-1.5">
            <div className="flex flex-[2] flex-col gap-1.5">
              <div className="rounded-lg bg-primary/25 px-2 py-4 text-center text-[10px] font-semibold text-primary">
                Dining &amp; pass
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1 rounded-lg bg-white/10 py-6 text-center text-[9px] text-white/50">Bar</div>
                <div className="flex-1 rounded-lg bg-emerald-500/15 py-6 text-center text-[9px] text-emerald-200/80">
                  Terrace
                </div>
              </div>
            </div>
            <div className="flex w-[28%] flex-col gap-1.5">
              <div className="flex-1 rounded-lg bg-amber-500/10 py-8 text-center text-[9px] text-amber-100/70">
                Lounge / DJ
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Package builder */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold text-foreground">Your package</h2>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Event type</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(HOST_EVENT_TYPE_LABELS) as HostEventType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPkg((p) => ({ ...p, eventType: key }))}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors btn-press",
                  pkg.eventType === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/30",
                )}
              >
                {HOST_EVENT_TYPE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guests</p>
            <span className="text-sm font-bold text-foreground">{pkg.guests}</span>
          </div>
          <Slider
            value={[pkg.guests]}
            onValueChange={setGuests}
            min={8}
            max={180}
            step={2}
            className="py-2"
          />
          <p className="text-[11px] text-muted-foreground">Drag to match your invite list — pricing scales per head for F&amp;B.</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Space</p>
          <div className="space-y-2">
            {(Object.keys(HOST_SPACE_LABELS) as HostSpace[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPkg((p) => ({ ...p, space: key }))}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors btn-press",
                  pkg.space === key
                    ? "border-primary bg-primary/12 text-foreground"
                    : "border-border bg-card hover:border-primary/25",
                )}
              >
                {HOST_SPACE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {pkg.durationHours}h
            </span>
          </div>
          <Slider
            value={[pkg.durationHours]}
            onValueChange={setHours}
            min={2}
            max={9}
            step={1}
            className="py-2"
          />
          <p className="text-[11px] text-muted-foreground">First 3h included in the base flow; extra hours add service &amp; staffing.</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Catering style</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(HOST_CATERING_LABELS) as HostCatering[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPkg((p) => ({ ...p, catering: key }))}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left text-xs font-semibold leading-snug transition-colors btn-press",
                  pkg.catering === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/30",
                )}
              >
                {HOST_CATERING_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Add-ons</p>
          <div className="space-y-2">
            <ToggleRow
              active={pkg.addDj}
              onToggle={() => setPkg((p) => ({ ...p, addDj: !p.addDj }))}
              icon={Mic2}
              label="DJ & dance-floor energy"
              hint="Evening set + basic lighting"
            />
            <ToggleRow
              active={pkg.addAv}
              onToggle={() => setPkg((p) => ({ ...p, addAv: !p.addAv }))}
              icon={Monitor}
              label="AV & speeches"
              hint="Mic, screen or playlist integration"
            />
            <ToggleRow
              active={pkg.addDecor}
              onToggle={() => setPkg((p) => ({ ...p, addDecor: !p.addDecor }))}
              icon={Flower2}
              label="Styling & florals"
              hint="Starter decor package"
            />
            <ToggleRow
              active={pkg.addPhoto}
              onToggle={() => setPkg((p) => ({ ...p, addPhoto: !p.addPhoto }))}
              icon={Camera}
              label="Event photography"
              hint="~4h coverage on site"
            />
          </div>
        </div>
      </section>

      {/* Estimate + advisor */}
      <section className="space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-background p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Instant estimate</h2>
            <p className="text-[11px] text-muted-foreground">Rule-based assistant — not a binding quote</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/40 px-3 py-3">
          <ul className="space-y-2">
            {estimate.lineItems.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="shrink-0 font-semibold text-foreground">{formatPrice(row.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-foreground">{formatPrice(estimate.subtotal)}</span>
            </li>
            <li className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Service ({estimate.serviceChargePct}%)</span>
              <span className="font-semibold text-foreground">{formatPrice(estimate.serviceCharge)}</span>
            </li>
          </ul>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Ballpark range</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {formatPrice(estimate.bandLow)} – {formatPrice(estimate.bandHigh)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Anchor total ≈ {formatPrice(estimate.total)}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 text-primary">
            <ChefHat className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Assistant note</span>
          </div>
          {estimate.advisorParagraphs.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {para}
            </p>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ready to hold a date or tweak the menu? Tap the <strong className="text-foreground">chat bubble</strong> on the
            home screen — we&apos;ll route you to events and send a proper proposal.
          </p>
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 pb-2 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>Corporate retainers &amp; buyouts quoted separately</span>
      </div>
    </div>
  );
}
