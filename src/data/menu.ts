/**
 * Menu photos live in `src/assets/` (dish-*.jpg).
 */
import dishBurger from "@/assets/dish-burger.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishFries from "@/assets/dish-fries.jpg";
import dishDessert from "@/assets/dish-dessert.jpg";

export interface SteakVariation {
  size: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  /** Set true only after this photo has been verified to depict the exact dish. */
  verifiedImage?: boolean;
  category: string;
  featured?: boolean;
  popular?: boolean;
  tag?: string;
  variations?: SteakVariation[];
}

export const foodCategories = [
  "Kick Start",
  "Choice Cuts",
  "Poultry",
  "Salads",
  "Combos",
  "Land + Sea",
  "Local Favourites",
  "Burgers",
  "Desserts",
];

export const foodMenu = {
  "Kick Start": [
    {
      id: 1,
      name: "Three Cheese Prawns",
      desc: "Plump peeled prawns baked in a creamy garlic & mascarpone cheese sauce topped with mature cheddar & grated parmigiana cheese.",
      price: 120,
      tag: "Local Favourite",
    },
    {
      id: 2,
      name: "Marrow Bones",
      desc: "Oven roasted with fresh thyme, rosemary & garlic. Served with a red wine & herb jus & sourdough.",
      price: 95,
    },
    {
      id: 3,
      name: "Chicken Livers",
      desc: "Pan-fried in onion, garlic & peri-peri sauce.",
      price: 95,
    },
    {
      id: 4,
      name: "Beef Carpaccio",
      desc: "Paper thin slices of raw beef fillet, drizzled with olive oil, capers, rocket & parmigiana shavings.",
      price: 125,
    },
  ],
  "Choice Cuts": [
    {
      id: 10,
      name: "Rump Steak",
      desc: "Very tasty & succulent. Wet-aged for a minimum of 21 days.",
      basePrice: 235,
      variations: [
        { size: "200g", price: 235 },
        { size: "300g", price: 295 },
        { size: "400g", price: 365 },
      ],
      tag: "Choice Cut",
    },
    {
      id: 11,
      name: "Tomahawk Steak",
      desc: "Rib eye on the bone.",
      basePrice: 625,
      variations: [{ size: "800g", price: 625 }],
      tag: "Premium",
    },
    {
      id: 12,
      name: "Fillet",
      desc: "Most tender cut.",
      basePrice: 285,
      variations: [
        { size: "200g", price: 285 },
        { size: "300g", price: 345 },
        { size: "400g", price: 415 },
      ],
    },
  ],
  Poultry: [
    {
      id: 13,
      name: "Chicken Schnitzel",
      desc: "Golden brown crumbed chicken fillet served with mushroom or cheese sauce.",
      price: 195,
    },
    {
      id: 14,
      name: "Spatchcock",
      desc: "Chargrilled & baked with lemon & herb, peri-peri or sticky bbq basting.",
      price: 295,
    },
  ],
  Salads: [
    {
      id: 20,
      name: "Chicken Caesar",
      desc: "Chargrilled chicken, cos lettuce, boiled egg, crispy Parma ham & Caesar dressing.",
      price: 215,
    },
    {
      id: 21,
      name: "Greek",
      desc: "Crisp greens, cucumber, bella tomatoes, red onions, calamata olives & feta.",
      price: 145,
    },
  ],
  Combos: [
    {
      id: 30,
      name: "Rib + Steak",
      desc: "Pork or Beef ribs + 200g grilled rump or sirloin. Served with a complimentary side.",
      price: 485,
      tag: "Feast",
    },
    {
      id: 31,
      name: "Steak + Prawn",
      desc: "200g Rump or Sirloin + grilled prawns with your choice of basting.",
      price: 425,
    },
  ],
  "Land + Sea": [
    {
      id: 40,
      name: "Oxtail",
      desc: "Simmered in Guinness, plum tomatoes, carrots & haricot beans. Served with mashed potatoes.",
      price: 295,
    },
    {
      id: 41,
      name: "Kingklip",
      desc: "Filleted, lightly floured & grilled in a creamy lemon & herb butter.",
      price: 295,
    },
  ],
  "Local Favourites": [
    {
      id: 50,
      name: "Butcher Block Burger",
      desc: "Caramelised onion, peppadew, bacon, cheddar & mozzarella.",
      price: 195,
    },
    {
      id: 51,
      name: "Jalapeño + Biltong Burger",
      desc: "Cheddar cheese, jalapeño & biltong sauce.",
      price: 195,
    },
  ],
  Desserts: [
    {
      id: 60,
      name: "Mississippi Mud Pie",
      desc: "Rich chocolate brownie base blended with seasonal tree nuts, buried under a thick layer of decadent hazelnut & chocolate mousse.",
      price: 75,
    },
    {
      id: 61,
      name: "Malva Pudding",
      desc: "Cape Malay style served with fresh cream or vanilla ice cream.",
      price: 85,
    },
  ],
};

export const steakhouseMenu = foodMenu;

export const drinkCategories = ["Wine", "Cocktails", "Jars", "Shooters"];

export const wineList = [
  {
    id: 1,
    category: "Sauvignon Blanc",
    name: "Anthonij Rupert Cape of Good Hope Altima",
    region: "Franschhoek",
    bottle: "N$ 395",
    price: 395,
  },
  {
    id: 2,
    category: "Sauvignon Blanc",
    name: "Springfield Life from Stone",
    region: "Robertson",
    bottle: "N$ 415",
    price: 415,
  },
  {
    id: 3,
    category: "Cabernet Sauvignon",
    name: "Rust En Vrede Estate Vineyards",
    region: "Stellenbosch",
    bottle: "N$ 845",
    price: 845,
  },
  {
    id: 4,
    category: "Pinotage",
    name: "Kanonkop Estate",
    region: "Stellenbosch",
    bottle: "N$ 1465",
    price: 1465,
  },
];

export const wineMenu = wineList;

export const cocktailList = [
  {
    id: 10,
    name: "Moscow Mule",
    desc: "Vodka, ginger beer, lime juice, cucumber syrup. Served in a mule mug.",
    tag: "Classic",
    price: 95,
  },
  {
    id: 11,
    name: "Springbok Shooter",
    desc: "Peppermint liqueur, Amarula.",
    tag: "Shooter",
    price: 45,
  },
  {
    id: 12,
    name: "Pimm's Jar",
    desc: "Pimm's, cucumber ribbons, mixed berries, lemonade.",
    tag: "Jar",
    price: 115,
  },
  {
    id: 13,
    name: "Espresso Martini",
    desc: "Premium vodka, coffee liqueur & fresh espresso.",
    tag: "Classic",
    price: 95,
  },
];

export const cocktailMenu = cocktailList;

export const menuItems: MenuItem[] = [
  // ── KICK START ────────────────────────────────────────────
  {
    id: "1",
    name: "Three Cheese Prawns",
    description:
      "Plump peeled prawns baked in a creamy garlic & mascarpone cheese sauce topped with mature cheddar & grated parmigiana cheese.",
    price: 120,
    image: dishFries,
    category: "Kick Start",
    featured: true,
    popular: true,
    tag: "Popular",
  },
  {
    id: "2",
    name: "Chicken Livers",
    description: "Chicken livers pan-fried in onion, garlic & peri-peri sauce.",
    price: 95,
    image: dishFries,
    category: "Kick Start",
    popular: true,
  },
  {
    id: "3",
    name: "Marrow Bones",
    description:
      "Oven roasted with fresh thyme, rosemary & garlic. Served with a red wine & herb jus & sourdough.",
    price: 95,
    image: dishLamb,
    category: "Kick Start",
    featured: true,
    popular: true,
  },
  {
    id: "4",
    name: "Beef Carpaccio",
    description:
      "Paper thin slices of raw beef fillet, drizzled with olive oil, capers, rocket & parmigiana shavings.",
    price: 125,
    image: dishLamb,
    category: "Kick Start",
    featured: true,
  },

  // ── SALADS ────────────────────────────────────────────────
  {
    id: "5",
    name: "Chicken Caesar",
    description:
      "Chargrilled chicken, cos lettuce, boiled egg, crispy Parma ham & Caesar dressing.",
    price: 215,
    image: dishFries,
    category: "Salads",
    popular: true,
  },
  {
    id: "27",
    name: "Greek Salad",
    description:
      "Crisp greens, cucumber, bella tomatoes, red onions, calamata olives & feta.",
    price: 145,
    image: dishFries,
    category: "Salads",
  },

  // ── CHOICE CUTS ───────────────────────────────────────────
  {
    id: "6",
    name: "Tomahawk Steak (800g)",
    description:
      "800g rib eye on the bone. 100% Namibian grass-fed, wet-aged beef grilled over charcoal and served with a complimentary side.",
    price: 625,
    image: dishLamb,
    category: "Choice Cuts",
    featured: true,
    popular: true,
    tag: "Premium",
    variations: [{ size: "800g", price: 625 }],
  },
  {
    id: "7",
    name: "Rump Steak",
    description:
      "Very tasty & succulent. Wet-aged for a minimum of 21 days. Available in 200g (N$ 235), 300g (N$ 295) & 400g (N$ 365).",
    price: 235,
    image: dishLamb,
    category: "Choice Cuts",
    featured: true,
    popular: true,
    tag: "Choice Cut",
    variations: [
      { size: "200g", price: 235 },
      { size: "300g", price: 295 },
      { size: "400g", price: 365 },
    ],
  },
  {
    id: "18",
    name: "Fillet",
    description:
      "Most tender cut, lean and melt-in-the-mouth. Available in 200g (N$ 285), 300g (N$ 345) & 400g (N$ 415).",
    price: 285,
    image: dishLamb,
    category: "Choice Cuts",
    featured: true,
    popular: true,
    tag: "Choice Cut",
    variations: [
      { size: "200g", price: 285 },
      { size: "300g", price: 345 },
      { size: "400g", price: 415 },
    ],
  },
  {
    id: "20",
    name: "Sirloin Steak",
    description:
      "Full-flavoured prime Namibian cut with a golden charcoal-seared rim. 200g (N$ 230), 300g (N$ 290) & 400g (N$ 360).",
    price: 230,
    image: dishLamb,
    category: "Choice Cuts",
    popular: true,
    tag: "Choice Cut",
    variations: [
      { size: "200g", price: 230 },
      { size: "300g", price: 290 },
      { size: "400g", price: 360 },
    ],
  },
  {
    id: "21",
    name: "Butcher's Choice Camembert + Bacon",
    description:
      "300g prime wet-aged cut topped with melted camembert wheel, crispy bacon & cranberry preserve.",
    price: 355,
    image: dishLamb,
    category: "Choice Cuts",
    featured: true,
    popular: true,
    tag: "Choice Cut",
  },
  {
    id: "22",
    name: "Bordelaise & Bone Marrow Sirloin",
    description:
      "300g wet-aged sirloin crowned with roasted bone marrow and rich red wine Bordelaise jus.",
    price: 365,
    image: dishLamb,
    category: "Choice Cuts",
    featured: true,
  },

  // ── POULTRY ───────────────────────────────────────────────
  {
    id: "28",
    name: "Chicken Schnitzel",
    description:
      "Golden brown crumbed chicken fillet served with mushroom or cheese sauce.",
    price: 195,
    image: dishLamb,
    category: "Poultry",
    popular: true,
  },
  {
    id: "29",
    name: "Spatchcock",
    description:
      "Chargrilled & baked with lemon & herb, peri-peri or sticky bbq basting.",
    price: 295,
    image: dishLamb,
    category: "Poultry",
    featured: true,
  },

  // ── COMBOS ────────────────────────────────────────────────
  {
    id: "23",
    name: "Rib + Steak",
    description:
      "Pork or Beef ribs + 200g grilled rump or sirloin. Served with a complimentary side.",
    price: 485,
    image: dishLamb,
    category: "Combos",
    featured: true,
    popular: true,
    tag: "Feast",
  },
  {
    id: "30",
    name: "Steak + Prawn",
    description:
      "200g Rump or Sirloin + grilled prawns with your choice of basting.",
    price: 425,
    image: dishLamb,
    category: "Combos",
    popular: true,
  },

  // ── LAND + SEA ────────────────────────────────────────────
  {
    id: "24",
    name: "Oxtail",
    description:
      "Simmered in Guinness, plum tomatoes, carrots & haricot beans. Served with mashed potatoes.",
    price: 295,
    image: dishLamb,
    category: "Land + Sea",
    featured: true,
    popular: true,
  },
  {
    id: "31",
    name: "Kingklip",
    description:
      "Filleted, lightly floured & grilled in a creamy lemon & herb butter.",
    price: 295,
    image: dishFries,
    category: "Land + Sea",
    popular: true,
  },

  // ── LOCAL FAVOURITES / BURGERS ────────────────────────────
  {
    id: "8",
    name: "Jalapeño + Biltong Burger",
    description:
      "Cheddar cheese, jalapeño & biltong sauce & sliced jalapeños on a toasted brioche bun.",
    price: 195,
    image: dishBurger,
    category: "Burgers",
    featured: true,
    popular: true,
    tag: "Local Favourite",
  },
  {
    id: "25",
    name: "Butcher Block Burger",
    description:
      "Caramelised onion, peppadew, bacon, cheddar & mozzarella cheese on our signature charcoal-grilled patty.",
    price: 195,
    image: dishBurger,
    category: "Burgers",
    featured: true,
    popular: true,
    tag: "Local Favourite",
  },

  // ── SIDES & SAUCES ────────────────────────────────────────
  {
    id: "9",
    name: "Pap & Chakalaka",
    description:
      "Traditional stiff maize pap served with spicy tomato, onion & bean chakalaka relish.",
    price: 45,
    image: dishFries,
    category: "Sides",
  },
  {
    id: "10",
    name: "Baked Potato & Sour Cream",
    description: "Oven-baked jacket potato topped with herb butter, sour cream & fresh chives.",
    price: 45,
    image: dishFries,
    category: "Sides",
  },
  {
    id: "11",
    name: "Cowboy Butter & Steakhouse Sauces",
    description:
      "Choose from Cowboy Butter, Creamy Garlic, Green Peppercorn, Mushroom, or Red Wine Bordelaise.",
    price: 55,
    image: dishFries,
    category: "Sides",
  },

  // ── DESSERTS ──────────────────────────────────────────────
  {
    id: "12",
    name: "Mississippi Mud Pie",
    description:
      "Rich chocolate brownie base blended with seasonal tree nuts, buried under a thick layer of decadent hazelnut & chocolate mousse.",
    price: 75,
    image: dishDessert,
    category: "Desserts",
    featured: true,
    popular: true,
  },
  {
    id: "13",
    name: "Malva Pudding",
    description: "Cape Malay style warm sponge pudding served with fresh cream or vanilla ice cream.",
    price: 85,
    image: dishDessert,
    category: "Desserts",
    popular: true,
  },

  // ── DRINKS (WINE, COCKTAILS, JARS, SHOOTERS) ──────────────
  {
    id: "14",
    name: "Moscow Mule",
    description:
      "Vodka, ginger beer, lime juice, cucumber syrup. Served in a mule mug over crushed ice.",
    price: 95,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
    popular: true,
    tag: "Classic",
  },
  {
    id: "15",
    name: "Espresso Martini",
    description: "Premium vodka, coffee liqueur & fresh espresso shaken cold.",
    price: 95,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
    tag: "Classic",
  },
  {
    id: "32",
    name: "Pimm's Jar",
    description: "Pimm's, cucumber ribbons, mixed berries, lemonade.",
    price: 115,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
    tag: "Jar",
  },
  {
    id: "19",
    name: "Springbok Shooter",
    description: "Peppermint liqueur layered beneath creamy Amarula.",
    price: 45,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
    tag: "Shooter",
  },
  {
    id: "17",
    name: "Anthonij Rupert Cape of Good Hope Altima",
    description:
      "Sauvignon Blanc • Franschhoek — Cool-climate Sauvignon Blanc with bright citrus & mineral finish (Bottle).",
    price: 395,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
  },
  {
    id: "26",
    name: "Springfield Life from Stone",
    description:
      "Sauvignon Blanc • Robertson — Rocky quartz terroir Sauvignon Blanc with passionfruit & lime (Bottle).",
    price: 415,
    image: dishCocktail,
    category: "Drinks",
    popular: true,
  },
  {
    id: "16",
    name: "Rust En Vrede Estate Vineyards",
    description:
      "Cabernet Sauvignon • Stellenbosch — Full-bodied benchmark South African Cabernet with cassis & cedar oak (Bottle).",
    price: 845,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
  },
  {
    id: "33",
    name: "Kanonkop Estate Pinotage",
    description:
      "Pinotage • Stellenbosch — Iconic South African Pinotage with rich dark plum, red fruit & French oak complexity (Bottle).",
    price: 1465,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
  },
];

export const categories = [
  "All",
  "Choice Cuts",
  "Kick Start",
  "Poultry",
  "Salads",
  "Combos",
  "Land + Sea",
  "Burgers",
  "Sides",
  "Desserts",
  "Drinks",
];
