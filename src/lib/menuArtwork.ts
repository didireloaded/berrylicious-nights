import dishBurger from "@/assets/dish-burger.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishFries from "@/assets/dish-fries.jpg";
import dishDessert from "@/assets/dish-dessert.jpg";
import type { MenuItem } from "@/data/menu";

const categoryPhotos: Record<string, string | undefined> = {
  // Food categories
  "Choice Cuts": dishLamb,
  "Butcher's Choice": dishLamb,
  "Kick Start": dishFries,
  Poultry: dishLamb,
  Combos: dishLamb,
  "Land + Sea": dishLamb,
  "Local Favourites": dishBurger,
  Burgers: dishBurger,
  Mains: dishLamb,
  Sides: dishFries,
  "Sides & Sauces": dishFries,
  Desserts: dishDessert,
  // Drink categories
  Drinks: dishCocktail,
  Cocktails: dishCocktail,
  Jars: dishCocktail,
  Shooters: dishCocktail,
  "Sauvignon Blanc": dishCocktail,
  "Chardonnay & White": dishCocktail,
  "Rosé & Semi-Sweet": dishCocktail,
  "Cabernet Sauvignon": dishCocktail,
  "Pinotage & Pinot Noir": dishCocktail,
  "Merlot & Shiraz": dishCocktail,
  "Red Blends": dishCocktail,
  "Bubbles & Dessert": dishCocktail,
};

export function menuArtwork(item: MenuItem): { src: string | null; isExactDish: boolean } {
  if (item.verifiedImage) return { src: item.image, isExactDish: true };
  return { src: categoryPhotos[item.category] ?? null, isExactDish: false };
}

export function categoryArtwork(category: string): string | null {
  if (category === "All") return dishBurger;
  return categoryPhotos[category] ?? null;
}

export function drinkCategoryArtwork(category: string): string | null {
  if (category === "All") return dishCocktail;
  return categoryPhotos[category] ?? dishCocktail;
}
