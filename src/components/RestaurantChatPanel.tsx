import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  BerryliciousHostActionChips,
  BerryliciousHostProvider,
  BerryliciousHostThread,
  type HostPlanHandoff,
} from "@/components/BerryliciousHostConcierge";
import { ensureRestaurantChat } from "@/lib/restaurantChat";
import { persistSuggestedNight } from "@/lib/suggestedNight";
import { cn } from "@/lib/utils";

export type RestaurantChatRow = {
  id: string;
  author_id: string;
  from_staff: boolean;
  body: string;
  created_at: string;
};

type RestaurantChatPanelProps = {
  /** When false, realtime and fetch are torn down (e.g. sheet closed). */
  active: boolean;
  /** Unique realtime channel suffix if multiple panels could mount for the same user. */
  realtimeScope?: string;
  className?: string;
  listClassName?: string;
};

export function RestaurantChatPanel({
  active,
  realtimeScope = "default",
  className,
  listClassName,
}: RestaurantChatPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RestaurantChatRow[]>([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setChatId(null);
      setMessages([]);
      setReady(false);
      return;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!active || !user) return;

    let cancelled = false;
    void (async () => {
      const { chatId: id, error } = await ensureRestaurantChat(supabase, user.id);
      if (cancelled) return;
      if (error || !id) {
        toast.error(error || "Could not start chat");
        setReady(true);
        return;
      }
      setChatId(id);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, user]);

  const loadMessages = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from("restaurant_chat_messages")
        .select("id, author_id, from_staff, body, created_at")
        .eq("chat_id", id)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      setMessages((data ?? []) as RestaurantChatRow[]);
      scrollToBottom();
    },
    [scrollToBottom],
  );

  useEffect(() => {
    if (!active || !chatId || !user) return;

    void loadMessages(chatId);

    const channel = supabase
      .channel(`restaurant-dm-${realtimeScope}-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restaurant_chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const row = payload.new as RestaurantChatRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          scrollToBottom();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, chatId, user, loadMessages, scrollToBottom, realtimeScope]);

  useEffect(() => {
    if (active) scrollToBottom();
  }, [messages.length, active, scrollToBottom]);

  const handleHostBook = useCallback(
    (h: HostPlanHandoff) => {
      const drinkSummary =
        h.plan.drinkCount > 1 ? `${h.plan.drinkCount}× ${h.plan.drink.name}` : h.plan.drink.name;
      persistSuggestedNight({
        time: h.plan.time,
        food: h.plan.food.name,
        drink: drinkSummary,
        guests: h.guestCount,
      });
      navigate("/plan", {
        state: {
          hostPlan: {
            people: h.people,
            vibe: h.vibe,
            preferredTime: h.preferredTime,
          },
        },
      });
    },
    [navigate],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || !user || !chatId) return;
    setInput("");
    const { error } = await supabase.from("restaurant_chat_messages").insert({
      chat_id: chatId,
      author_id: user.id,
      from_staff: false,
      body: text,
    });
    if (error) {
      toast.error(error.message);
      setInput(text);
    }
  };

  if (!user) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-[#0b0b0b]", className)}>
      <BerryliciousHostProvider onBookPlan={handleHostBook}>
        <div
          className={cn(
            "min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5",
            listClassName,
          )}
        >
          {!ready && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="h-10 w-10 animate-pulse rounded-full bg-primary/25" />
              <p className="text-sm text-white/45">Syncing with the house…</p>
            </div>
          )}
          <BerryliciousHostThread />
          {ready && messages.length > 0 && (
            <div className="pt-4">
              <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
                From the team
              </p>
              <div className="space-y-4">
                {messages.map((m) => {
                  const mine = !m.from_staff;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-4 py-3 text-[15px] shadow-sm",
                          mine
                            ? "rounded-br-md bg-gradient-to-br from-primary to-primary/88 text-primary-foreground"
                            : "rounded-bl-md border border-white/10 bg-[#1a1a1a] text-white/95",
                        )}
                      >
                        {!mine && (
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                            Berrylicious
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                        <p
                          className={cn(
                            "mt-2 text-[10px] tabular-nums",
                            mine ? "text-primary-foreground/65" : "text-white/40",
                          )}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b0b] px-4 pb-1 pt-3">
          <BerryliciousHostActionChips />
        </div>
      </BerryliciousHostProvider>

      <div className="border-t border-white/[0.08] bg-[#080808]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-white/35">
          Write to the team
        </p>
        <div className="mx-auto flex max-w-lg items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Dietary needs, table notes, anything else…"
            rows={1}
            className="min-h-[48px] max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-white/35 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={!ready || !chatId}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!ready || !chatId || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-transform disabled:opacity-40 btn-press active:scale-[0.97]"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
