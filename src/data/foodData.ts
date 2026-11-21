export interface FoodVariation {
  size: string;
  price: number;
}

export interface StructuredFoodItem {
  id: number;
  name: string;
  desc: string;
  price?: number;
  basePrice?: number;
  variations?: FoodVariation[];
  tag?: string;
}

export const foodCategories = [
  "Kick Start",
  "Choice Cuts",
  "Poultry",
  "Salads",
  "Combos",
  "Land + Sea",
  "Local Favourites",
  "Desserts",
] as const;

export const foodMenu: Record<(typeof foodCategories)[number], StructuredFoodItem[]> = {
  "Kick Start": [
    {
      id: 1,
      name: "Three Cheese Prawns",
      desc: "Plump peeled prawns baked in a creamy garlic & mascarpone cheese sauce topped with mature cheddar.",
      price: 120,
      tag: "Popular",
    },
    {
      id: 2,
      name: "Marrow Bones",
      desc: "Oven roasted with fresh thyme, rosemary & garlic. Served with a red wine jus & sourdough.",
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
      desc: "Paper thin slices of raw beef fillet, capers, rocket & parmigiana shavings.",
      price: 125,
    },
  ],
  "Choice Cuts": [
    {
      id: 100,
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
      id: 101,
      name: "Tomahawk Steak",
      desc: "Rib eye on the bone. Served with a complimentary side.",
      basePrice: 625,
      variations: [{ size: "800g", price: 625 }],
      tag: "Premium",
    },
    {
      id: 102,
      name: "Fillet",
      desc: "Most tender cut.",
      basePrice: 285,
      variations: [
        { size: "200g", price: 285 },
        { size: "300g", price: 345 },
        { size: "400g", price: 415 },
      ],
      tag: "Choice Cut",
    },
    {
      id: 103,
      name: "Sirloin Steak",
      desc: "Full-flavoured prime Namibian cut with a golden charcoal-seared rim.",
      basePrice: 230,
      variations: [
        { size: "200g", price: 230 },
        { size: "300g", price: 290 },
        { size: "400g", price: 360 },
      ],
      tag: "Choice Cut",
    },
    {
      id: 104,
      name: "Butcher's Choice Camembert + Bacon",
      desc: "300g prime wet-aged cut topped with melted camembert wheel, crispy bacon & cranberry preserve.",
      price: 355,
      tag: "Choice Cut",
    },
    {
      id: 105,
      name: "Bordelaise & Bone Marrow Sirloin",
      desc: "300g wet-aged sirloin crowned with roasted bone marrow and rich red wine Bordelaise jus.",
      price: 365,
      tag: "Choice Cut",
    },
  ],
  Poultry: [
    {
      id: 10,
      name: "Chicken Schnitzel",
      desc: "Golden brown crumbed chicken fillet served with mushroom or cheese sauce.",
      price: 195,
    },
    {
      id: 11,
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
