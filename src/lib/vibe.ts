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
      return "Good morning ☕ — today's menu is ready";
    case "afternoon":
      return "Lunch at Berrylicious 🍽️ — specials today";
    case "evening":
      return "🔥 Live DJ Tonight • Busy vibe • Cocktail specials";
    case "latenight":
      return "The lounge is calling 🍸";
  }
}

export function formatPrice(price: number) {
  return `N$ ${price}`;
}
