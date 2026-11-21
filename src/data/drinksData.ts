export const drinkCategories = ["Wine", "Cocktails", "Jars", "Shooters"] as const;

export interface WineEntry {
  id: number;
  category: string;
  name: string;
  region: string;
  bottle: string;
  price: number;
}

export interface CocktailEntry {
  id: number;
  name: string;
  desc: string;
  tag: "Classic" | "Shooter" | "Jar";
  price: number;
}

export const wineList: WineEntry[] = [
  {
    id: 1,
    category: "Sauvignon Blanc",
    name: "Anthonij Rupert Cape of Good Hope Altima",
    region: "Franschhoek",
    bottle: "NS395",
    price: 395,
  },
  {
    id: 2,
    category: "Sauvignon Blanc",
    name: "Springfield Life from Stone",
    region: "Robertson",
    bottle: "NS415",
    price: 415,
  },
  {
    id: 3,
    category: "Cabernet Sauvignon",
    name: "Rust En Vrede Estate Vineyards",
    region: "Stellenbosch",
    bottle: "NS845",
    price: 845,
  },
  {
    id: 4,
    category: "Pinotage",
    name: "Kanonkop Estate",
    region: "Stellenbosch",
    bottle: "NS1465",
    price: 1465,
  },
];

export const cocktailList: CocktailEntry[] = [
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
