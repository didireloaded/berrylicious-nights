import { useState } from "react";
import { menuItems, categories } from "@/data/menu";
import MenuCard from "@/components/MenuCard";
import CartBar from "@/components/CartBar";

const MenuPage = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? menuItems : menuItems.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-6 max-w-lg mx-auto">
        <h1 className="font-display text-3xl font-bold mb-6">Our Menu</h1>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <CartBar />
    </div>
  );
};

export default MenuPage;
