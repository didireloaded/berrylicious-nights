import { formatPrice } from "@/lib/vibe";

export type HostEventType = "birthday" | "corporate" | "wedding" | "product" | "celebration" | "other";

export type HostSpace = "dining" | "terrace" | "semi_private" | "full_venue";

export type HostCatering = "cocktails" | "canapes" | "buffet" | "seated";

export type HostEventPackage = {
  eventType: HostEventType;
  guests: number;
  space: HostSpace;
  durationHours: number;
  catering: HostCatering;
  addDj: boolean;
  addAv: boolean;
  addDecor: boolean;
  addPhoto: boolean;
};

export type HostLineItem = { id: string; label: string; amount: number };

export type HostEventEstimate = {
  lineItems: HostLineItem[];
  subtotal: number;
  serviceChargePct: number;
  serviceCharge: number;
  total: number;
  bandLow: number;
  bandHigh: number;
  advisorParagraphs: string[];
};

export const HOST_EVENT_TYPE_LABELS: Record<HostEventType, string> = {
  birthday: "Birthday / milestone",
  corporate: "Corporate / team",
  wedding: "Wedding / engagement",
  product: "Product launch / PR",
  celebration: "Celebration / send-off",
  other: "Something else",
};

export const HOST_SPACE_LABELS: Record<HostSpace, string> = {
  dining: "Main dining (zones)",
  terrace: "Terrace & bar",
  semi_private: "Semi-private section",
  full_venue: "Full venue takeover",
};

export const HOST_CATERING_LABELS: Record<HostCatering, string> = {
  cocktails: "Drinks & welcome cocktail",
  canapes: "Canapés & grazing",
  buffet: "Buffet / stations",
  seated: "Seated dinner service",
};

/** Tunable venue economics — replace with admin config later. */
const SPACE_HIRE: Record<HostSpace, number> = {
  dining: 2800,
  terrace: 4200,
  semi_private: 6500,
  full_venue: 22000,
};

const PER_GUEST_CATERING: Record<HostCatering, number> = {
  cocktails: 140,
  canapes: 260,
  buffet: 420,
  seated: 580,
};

const TYPE_MULT: Record<HostEventType, number> = {
  birthday: 1,
  corporate: 1.12,
  wedding: 1.22,
  product: 1.18,
  celebration: 1.06,
  other: 1,
};

const ADDON_FLAT = {
  dj: 5200,
  av: 3100,
  decor: 3800,
  photo: 6500,
} as const;

function clampGuests(n: number): number {
  return Math.min(220, Math.max(8, Math.round(n)));
}

function clampHours(n: number): number {
  return Math.min(10, Math.max(2, Math.round(n)));
}

export function defaultHostPackage(): HostEventPackage {
  return {
    eventType: "celebration",
    guests: 40,
    space: "terrace",
    durationHours: 4,
    catering: "canapes",
    addDj: false,
    addAv: true,
    addDecor: false,
    addPhoto: false,
  };
}

export function estimateHostEvent(pkg: HostEventPackage): HostEventEstimate {
  const guests = clampGuests(pkg.guests);
  const hours = clampHours(pkg.durationHours);

  const lineItems: HostLineItem[] = [];

  const hire = SPACE_HIRE[pkg.space];
  lineItems.push({
    id: "space",
    label: `Venue hire — ${HOST_SPACE_LABELS[pkg.space]}`,
    amount: hire,
  });

  const cateringUnit = PER_GUEST_CATERING[pkg.catering] * TYPE_MULT[pkg.eventType];
  const cateringTotal = Math.round(guests * cateringUnit);
  lineItems.push({
    id: "catering",
    label: `Food & beverage (≈${guests} guests, ${HOST_CATERING_LABELS[pkg.catering].toLowerCase()})`,
    amount: cateringTotal,
  });

  const extraHours = Math.max(0, hours - 3);
  if (extraHours > 0) {
    const block = Math.max(1, Math.ceil(guests / 45));
    const ext = extraHours * block * 420;
    lineItems.push({
      id: "hours",
      label: `Extended time (${extraHours}h beyond included 3h)`,
      amount: ext,
    });
  }

  if (pkg.addDj) {
    lineItems.push({ id: "dj", label: "DJ / sound basics (evening)", amount: ADDON_FLAT.dj });
  }
  if (pkg.addAv) {
    lineItems.push({ id: "av", label: "AV — mic, screen or playlist hookup", amount: ADDON_FLAT.av });
  }
  if (pkg.addDecor) {
    lineItems.push({ id: "decor", label: "Styling & florals (starter package)", amount: ADDON_FLAT.decor });
  }
  if (pkg.addPhoto) {
    lineItems.push({ id: "photo", label: "Event photography (4h on-site)", amount: ADDON_FLAT.photo });
  }

  const subtotal = lineItems.reduce((s, x) => s + x.amount, 0);
  const serviceChargePct = 10;
  const serviceCharge = Math.round(subtotal * (serviceChargePct / 100));
  const total = subtotal + serviceCharge;
  const bandLow = Math.round(total * 0.92);
  const bandHigh = Math.round(total * 1.12);

  const advisorParagraphs = buildAdvisorCopy(pkg, guests, hours, total, bandLow, bandHigh, lineItems);

  return {
    lineItems,
    subtotal,
    serviceChargePct,
    serviceCharge,
    total,
    bandLow,
    bandHigh,
    advisorParagraphs,
  };
}

function buildAdvisorCopy(
  pkg: HostEventPackage,
  guests: number,
  hours: number,
  total: number,
  bandLow: number,
  bandHigh: number,
  items: HostLineItem[],
): string[] {
  const typeLabel = HOST_EVENT_TYPE_LABELS[pkg.eventType].toLowerCase();
  const spaceLabel = HOST_SPACE_LABELS[pkg.space].toLowerCase();

  const p1 = `For a ${typeLabel} with about ${guests} people across ${hours} hours in our ${spaceLabel}, we’d usually block the kitchen and service team to match your catering style — that’s what drives most of the estimate below.`;

  const cateringLine = items.find((i) => i.id === "catering");
  const p2 = cateringLine
    ? `At this headcount, ${HOST_CATERING_LABELS[pkg.catering].toLowerCase()} lands around ${formatPrice(cateringLine.amount)} of the subtotal before service — enough for a comfortable flow without rushing plates.`
    : `Your selected catering tier scales directly with guest count, so small tweaks to numbers move the needle more than swapping a single add-on.`;

  const addons = [
    pkg.addDj && "DJ",
    pkg.addAv && "AV",
    pkg.addDecor && "styling",
    pkg.addPhoto && "photography",
  ].filter(Boolean) as string[];

  const p3 =
    addons.length > 0
      ? `You’ve layered on ${addons.join(", ")} — we bundle those as fixed packages so pricing stays predictable on the night.`
      : `You can still add DJ, full decor, or photography later; the estimate updates instantly when you toggle them.`;

  const p4 = `Ballpark for what you’ve built: about ${formatPrice(bandLow)} – ${formatPrice(bandHigh)} all-in (incl. ${10}% service). Final numbers follow a quick walk-through and menu sign-off — use the chat bubble when you’re ready to hold a date.`;

  return [p1, p2, p3, p4];
}
