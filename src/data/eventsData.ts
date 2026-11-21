import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishBurger from "@/assets/dish-burger.jpg";

export interface ButcherBlockEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  description: string;
  image: string;
  tag: "Weekly" | "Special";
}

export const butcherBlockEvents: ButcherBlockEvent[] = [
  {
    id: 1,
    title: "Ladies Night",
    date: "Every Tuesday",
    time: "From 18:00",
    description:
      "Half price on a large selection of steaks & BOGO bubbles. Book a table for a lively evening.",
    image: dishCocktail,
    tag: "Weekly",
  },
  {
    id: 2,
    title: "Men's Night",
    date: "Every Wednesday",
    time: "From 18:00",
    description:
      "The equivalent of Ladies Night, but for the gents. Great steaks, great company.",
    image: dishLamb,
    tag: "Weekly",
  },
  {
    id: 3,
    title: "Father's Day Feast",
    date: "Third Sunday of June",
    time: "All Day",
    description:
      "Treat Dad to the ultimate steak experience. Special menu & a complimentary drink.",
    image: dishBurger,
    tag: "Special",
  },
];
