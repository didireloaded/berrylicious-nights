/**
 * Menu photos live in `src/assets/` (dish-*.jpg). Replace those files with your own
 * shots (e.g. from a shoot or export from social) — keep filenames or update imports.
 */
import dishBurger from "@/assets/dish-burger.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishFries from "@/assets/dish-fries.jpg";
import dishDessert from "@/assets/dish-dessert.jpg";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  featured?: boolean;
  popular?: boolean;
}

export const menuItems: MenuItem[] = [
  // ── STARTERS ──────────────────────────────────────────────
  {
    id: "1",
    name: "Beef Carpaccio",
    description: "Thinly sliced beef, balsamic glaze, rocket, shaved parmesan",
    price: 95,
    image: dishLamb,
    category: "Starters",
    featured: true,
  },
  {
    id: "2",
    name: "Salmon Tartare",
    description: "Fresh salmon, capers, red onion, dill, Berrylicious house sauce",
    price: 110,
    image: dishFries,
    category: "Starters",
    popular: true,
  },
  {
    id: "3",
    name: "Avocado, Prawn & Bacon Bruschetta",
    description: "Toasted sourdough, creamy avo, tiger prawns, crispy bacon",
    price: 105,
    image: dishFries,
    category: "Starters",
    popular: true,
  },

  // ── SALADS ────────────────────────────────────────────────
  {
    id: "4",
    name: "Salmon Sashimi Salad",
    description: "Sashimi-grade salmon, mixed greens, sesame dressing, pickled ginger",
    price: 130,
    image: dishFries,
    category: "Salads",
    featured: true,
  },
  {
    id: "5",
    name: "Tofu Bowl",
    description: "Pan-seared tofu, brown rice, edamame, cucumber, miso glaze",
    price: 95,
    image: dishFries,
    category: "Salads",
  },

  // ── MAINS ─────────────────────────────────────────────────
  {
    id: "6",
    name: "Tomahawk Steak",
    description: "800g bone-in ribeye, chimichurri, roasted garlic butter, seasonal sides",
    price: 420,
    image: dishLamb,
    category: "Mains",
    featured: true,
    popular: true,
  },
  {
    id: "7",
    name: "Baby Chicken",
    description: "Spatchcock poussin, lemon herb marinade, roasted vegetables, jus",
    price: 175,
    image: dishLamb,
    category: "Mains",
    popular: true,
  },

  // ── BURGERS ───────────────────────────────────────────────
  {
    id: "8",
    name: "The Licious Burger",
    description: "Teriyaki chicken breast, caramelised onions, creamy avocado, brioche bun",
    price: 115,
    image: dishBurger,
    category: "Burgers",
    featured: true,
    popular: true,
  },

  // ── SIDES ─────────────────────────────────────────────────
  {
    id: "9",
    name: "Butternut & Feta",
    description: "Roasted butternut, crumbled feta, honey glaze, fresh herbs",
    price: 55,
    image: dishFries,
    category: "Sides",
  },
  {
    id: "10",
    name: "Teriyaki Broccoli",
    description: "Tenderstem broccoli, teriyaki glaze, toasted almond flakes",
    price: 55,
    image: dishFries,
    category: "Sides",
  },
  {
    id: "11",
    name: "Chorizo Rice",
    description: "Fragrant saffron rice, Spanish chorizo, fresh herbs",
    price: 60,
    image: dishFries,
    category: "Sides",
  },

  // ── DESSERTS ──────────────────────────────────────────────
  {
    id: "12",
    name: "Whiskey Crème Brûlée",
    description: "Classic custard with a whiskey twist, caramelised sugar, chocolate soil",
    price: 85,
    image: dishDessert,
    category: "Desserts",
    featured: true,
    popular: true,
  },
  {
    id: "13",
    name: "Vanilla Panna Cotta",
    description: "Silky vanilla panna cotta, chocolate soil, fresh berry coulis",
    price: 80,
    image: dishDessert,
    category: "Desserts",
  },

  // ── DRINKS ────────────────────────────────────────────────
  {
    id: "14",
    name: "Espresso Martini",
    description: "Vodka, fresh espresso, coffee liqueur, vanilla — shaken cold",
    price: 95,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
    popular: true,
  },
  {
    id: "15",
    name: "Mango Sunrise",
    description: "Tequila, fresh mango, lime, grenadine, Tajín rim",
    price: 90,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
  },
  {
    id: "16",
    name: "House Red Wine",
    description: "Curated South African red, full-bodied, smooth finish",
    price: 75,
    image: dishCocktail,
    category: "Drinks",
  },
  {
    id: "17",
    name: "House White Wine",
    description: "Crisp South African white, refreshing and fruit-forward",
    price: 75,
    image: dishCocktail,
    category: "Drinks",
  },
  {
    id: "18",
    name: "Lamb Chops",
    description: "Herb-crusted lamb cutlets, roasted vegetables, red wine jus",
    price: 295,
    image: dishLamb,
    category: "Mains",
    featured: true,
  },
  {
    id: "19",
    name: "Classic Mojito",
    description: "White rum, fresh mint, lime, soda — Berrylicious style",
    price: 85,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
  },
];

export const categories = [
  "All",
  "Starters",
  "Salads",
  "Mains",
  "Burgers",
  "Sides",
  "Desserts",
  "Drinks",
];
