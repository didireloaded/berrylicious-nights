export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "latenight";
}

export function getVibeLine() {
  const time = getTimeOfDay();
  switch (time) {
    case "morning":
      return "Good morning ☕ — prime cuts & fresh flavours await";
    case "afternoon":
      return "Lunch at Butcher Block 🥩 — 100% Namibian wet-aged steaks";
    case "evening":
      return "🔥 The charcoal grill is alive tonight — fine wine & prime cuts";
    case "latenight":
      return "🍸 Craft cocktails, South African wines & Am Weinberg views";
  }
}

export function formatPrice(price: number) {
  return `N$ ${price}`;
}
