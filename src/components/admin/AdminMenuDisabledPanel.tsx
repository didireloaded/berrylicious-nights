import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { menuItems } from "@/data/menu";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

export function AdminMenuDisabledPanel() {
  const [disabled, setDisabled] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from("menu_item_disabled").select("menu_item_id");
    if (error) {
      toast.error(error.message);
      return;
    }
    setDisabled(new Set((data ?? []).map((r) => r.menu_item_id as string)));
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-menu-disabled")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_item_disabled" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const toggle = async (menuItemId: string, isOff: boolean) => {
    if (isOff) {
      const { error } = await (supabase as any).from("menu_item_disabled").delete().eq("menu_item_id", menuItemId);
      if (error) toast.error(error.message);
      else toast.success("Item available again");
    } else {
      const { error } = await supabase.from("menu_item_disabled").insert({ menu_item_id: menuItemId });
      if (error) toast.error(error.message);
      else toast.success("Item 86'd — hidden in app");
    }
    void load();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 max-w-lg">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
        <UtensilsCrossed className="w-5 h-5 text-primary" />
        Menu availability
      </h2>
      <p className="text-xs text-muted-foreground mb-4">Disabled items disappear from the guest menu in real time.</p>
      <ul className="space-y-1 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
        {menuItems.map((m) => {
          const off = disabled.has(m.id);
          return (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs">
              <span className="truncate text-foreground">
                <span className="text-muted-foreground font-mono">{m.id}</span> {m.name}
              </span>
              <button
                type="button"
                onClick={() => void toggle(m.id, off)}
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold btn-press ${
                  off ? "bg-emerald-500/20 text-emerald-400" : "bg-destructive/15 text-destructive"
                }`}
              >
                {off ? "Enable" : "86"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
