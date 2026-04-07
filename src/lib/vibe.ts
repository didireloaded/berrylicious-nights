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
      return "Good morning ☕ — fresh Mediterranean flavours await";
    case "afternoon":
      return "Lunch at Berrylicious 🍽️ — seasonal specials today";
    case "evening":
      return "🔥 The lounge is alive tonight — DJ, cocktails, fine dining";
    case "latenight":
      return "🍸 Drinks, vibes, and the city below — come in";
  }
}

export function formatPrice(price: number) {
  return `N$ ${price}`;
}
