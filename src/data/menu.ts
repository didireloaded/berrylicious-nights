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
  {
    id: "1",
    name: "Classic Smash Burger",
    description: "Double patty, aged cheddar, house sauce, brioche bun",
    price: 95,
    image: dishBurger,
    category: "Burgers",
    featured: true,
    popular: true,
  },
  {
    id: "2",
    name: "Chicken Burger",
    description: "Crispy chicken thigh, slaw, pickles, spicy mayo",
    price: 90,
    image: dishBurger,
    category: "Burgers",
    popular: true,
  },
  {
    id: "3",
    name: "Grilled Lamb Chops",
    description: "Herb-crusted lamb, rosemary jus, seasonal vegetables",
    price: 185,
    image: dishLamb,
    category: "Mains",
    featured: true,
  },
  {
    id: "4",
    name: "Beef Ribeye Steak",
    description: "300g grain-fed, garlic butter, roasted potatoes",
    price: 220,
    image: dishLamb,
    category: "Mains",
  },
  {
    id: "5",
    name: "Loaded Cheese Fries",
    description: "Crispy fries, cheddar sauce, crispy bacon, chives",
    price: 65,
    image: dishFries,
    category: "Starters",
    popular: true,
  },
  {
    id: "6",
    name: "Chicken Wings",
    description: "BBQ glazed, blue cheese dip, celery sticks",
    price: 75,
    image: dishFries,
    category: "Starters",
  },
  {
    id: "7",
    name: "Old Fashioned",
    description: "Bourbon, angostura bitters, orange peel, luxardo cherry",
    price: 85,
    image: dishCocktail,
    category: "Drinks",
    featured: true,
  },
  {
    id: "8",
    name: "Berry Bliss Cocktail",
    description: "Vodka, mixed berries, elderflower, prosecco top",
    price: 90,
    image: dishCocktail,
    category: "Drinks",
  },
  {
    id: "9",
    name: "Chocolate Lava Cake",
    description: "Warm chocolate fondant, vanilla ice cream, gold leaf",
    price: 75,
    image: dishDessert,
    category: "Desserts",
    featured: true,
  },
  {
    id: "10",
    name: "Crème Brûlée",
    description: "Classic vanilla custard, caramelised sugar top",
    price: 65,
    image: dishDessert,
    category: "Desserts",
  },
];

export const categories = ["All", "Burgers", "Mains", "Starters", "Drinks", "Desserts"];
