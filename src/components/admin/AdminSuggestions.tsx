import { getSuggestions, type KitchenOrder } from "@/lib/kitchen-ai";

interface Props {
  orders: KitchenOrder[];
}

const AdminSuggestions = ({ orders }: Props) => {
  const suggestions = getSuggestions(orders);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {suggestions.map((s, i) => (
        <div
          key={i}
          className={`shrink-0 text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
            s.type === "warning"
              ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
              : s.type === "action"
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          <span>{s.icon}</span>
          <span>{s.message}</span>
        </div>
      ))}
    </div>
  );
};

export default AdminSuggestions;
