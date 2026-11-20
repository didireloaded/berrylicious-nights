import dishBurger from "@/assets/dish-burger.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishFries from "@/assets/dish-fries.jpg";
import dishDessert from "@/assets/dish-dessert.jpg";
import type { MenuItem } from "@/data/menu";

/**
 * Existing photography is illustrative unless explicitly verified for the dish.
 * Never describe a category image as a photograph of an unrelated menu item.
 */
const categoryPhotos: Record<string, string | undefined> = {
  Burgers: dishBurger,
  Mains: dishLamb,
  Sides: dishFries,
  Desserts: dishDessert,
  Drinks: dishCocktail,
};

export function menuArtwork(item: MenuItem): { src: string | null; isExactDish: boolean } {
  if (item.verifiedImage) return { src: item.image, isExactDish: true };
  return { src: categoryPhotos[item.category] ?? null, isExactDish: false };
}
