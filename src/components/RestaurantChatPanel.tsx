import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ensureRestaurantChat } from "@/lib/restaurantChat";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export type RestaurantChatRow = {
  id: string;
  author_id: string;
  from_staff: boolean;
  body: string;
  created_at: string;
};

type RestaurantChatPanelProps = {
  active: boolean;
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
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RestaurantChatRow[]>([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
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
    return () => { cancelled = true; };
  }, [active, user]);

  const loadMessages = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from("restaurant_chat_messages")
        .select("id, author_id, from_staff, body, created_at")
        .eq("chat_id", id)
        .order("created_at", { ascending: true });
      if (error) { toast.error(error.message); return; }
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
        { event: "INSERT", schema: "public", table: "restaurant_chat_messages", filter: `chat_id=eq.${chatId}` },
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

    return () => { void supabase.removeChannel(channel); };
  }, [active, chatId, user, loadMessages, scrollToBottom, realtimeScope]);

  useEffect(() => {
    if (active) scrollToBottom();
  }, [messages.length, active, scrollToBottom]);

  const send = async () => {
    const text = input.trim();
    if (!text || !user || !chatId) return;
    setInput("");

    // Save user message to DB
    const { error: insertErr } = await supabase.from("restaurant_chat_messages").insert({
      chat_id: chatId,
      author_id: user.id,
      from_staff: false,
      body: text,
    });
    if (insertErr) {
      toast.error(insertErr.message);
      setInput(text);
      return;
    }

    // Build conversation history for AI context
    const recentMessages = [...messages.slice(-10), { from_staff: false, body: text }]
      .map((m) => ({
        role: m.from_staff ? "assistant" as const : "user" as const,
        content: m.body,
      }));

    // Get AI response
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("restaurant-chat-ai", {
        body: { messages: recentMessages, userId: user.id },
      });

      if (error) throw error;
      if (data?.error) {
        console.error("Chat AI error:", data.error);
        // Don't show error to user — just let the message sit for staff to answer
        return;
      }

      const reply = data?.reply;
      if (reply) {
        // Save AI reply as a "staff" message
        await supabase.from("restaurant_chat_messages").insert({
          chat_id: chatId,
          author_id: user.id, // system-generated but attributed to chat
          from_staff: true,
          body: reply,
        });
      }
    } catch (err) {
      console.error("Chat AI error:", err);
      // Silently fail — the message is saved, staff can respond manually
    } finally {
      setThinking(false);
    }
  };

  if (!user) return null;

  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-[#0b0b0b]", className)}>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-5",
          listClassName,
        )}
      >
        {!ready && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="h-10 w-10 animate-pulse rounded-full bg-primary/25" />
            <p className="text-sm text-white/45">Connecting…</p>
          </div>
        )}

        {ready && !hasMessages && !thinking && (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-white/90">Hey there! 👋</p>
              <p className="mt-1 text-xs text-white/50 max-w-[240px] leading-relaxed">
                Ask us anything — menu recommendations, bookings, dietary needs, or what's happening this week.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["What's popular?", "Any events this week?", "Vegetarian options?", "Book a table"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setInput(q); }}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {ready && hasMessages && (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = !m.from_staff;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 text-[14px] shadow-sm",
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
                    {mine ? (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-p:text-white/90 prose-strong:text-white prose-li:text-white/85 prose-li:my-0.5">
                        <ReactMarkdown>{m.body}</ReactMarkdown>
                      </div>
                    )}
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

            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-white/10 bg-[#1a1a1a] px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    Berrylicious
                  </p>
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <div
                        key={d}
                        className="w-2 h-2 rounded-full bg-primary/50 animate-pulse"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.08] bg-[#080808]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
            placeholder="Ask us anything…"
            rows={1}
            className="min-h-[48px] max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-white/35 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={!ready || !chatId || thinking}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!ready || !chatId || !input.trim() || thinking}
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
