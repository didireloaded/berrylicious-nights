import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type ChatListRow = {
  id: string;
  user_id: string;
  updated_at: string;
  display_name: string | null;
};

type MsgRow = {
  id: string;
  author_id: string;
  from_staff: boolean;
  body: string;
  created_at: string;
};

export function AdminMessagesPanel() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("restaurant_chats")
      .select("id, user_id, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Fetch display names from profiles
    const rows = (data ?? []) as { id: string; user_id: string; updated_at: string }[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    let nameMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      for (const p of profiles ?? []) {
        nameMap[p.user_id] = p.display_name;
      }
    }
    setChats(rows.map((r) => ({ ...r, display_name: nameMap[r.user_id] ?? null })));
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from("restaurant_chat_messages")
      .select("id, author_id, from_staff, body, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((data ?? []) as MsgRow[]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    void fetchChats();
    const ch = supabase
      .channel("admin-restaurant-dm")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "restaurant_chat_messages" },
        () => {
          void fetchChats();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [fetchChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedChatId);

    const ch = supabase
      .channel(`admin-thread-${selectedChatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restaurant_chat_messages",
          filter: `chat_id=eq.${selectedChatId}`,
        },
        (payload) => {
          const row = payload.new as MsgRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [selectedChatId, loadMessages]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selectedChatId || !user) return;
    setReply("");
    const { error } = await supabase.from("restaurant_chat_messages").insert({
      chat_id: selectedChatId,
      author_id: user.id,
      from_staff: true,
      body: text,
    });
    if (error) {
      toast.error(error.message);
      setReply(text);
    }
  };

  const selected = chats.find((c) => c.id === selectedChatId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_1fr] gap-4 min-h-[min(70vh,560px)]">
      <div className="rounded-xl border border-border bg-card/80 flex flex-col overflow-hidden max-h-[min(70vh,560px)] lg:max-h-none">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inbox</span>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {chats.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No conversations yet</p>}
          {chats.map((c) => {
            const label = c.display_name?.trim() || c.user_id.slice(0, 8);
            const active = c.id === selectedChatId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChatId(c.id)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors btn-press ${
                  active ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/30"
                }`}
              >
                <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/80 flex flex-col overflow-hidden min-h-[320px] max-h-[min(70vh,560px)]">
        {!selectedChatId && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            Select a guest thread to read and reply.
          </div>
        )}
        {selectedChatId && (
          <>
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-bold text-foreground">
                {selected?.display_name?.trim() || "Guest"}{" "}
                <span className="text-xs font-normal text-muted-foreground">({selected?.user_id.slice(0, 8)}…)</span>
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {messages.map((m) => {
                const staff = m.from_staff;
                return (
                  <div key={m.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                        staff
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md border border-border"
                      }`}
                    >
                      {staff && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/80 mb-0.5">
                          Staff
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${staff ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border p-2 flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                placeholder="Reply as restaurant…"
                rows={1}
                className="flex-1 min-h-[40px] max-h-28 resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={!reply.trim()}
                className="shrink-0 h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 btn-press"
                aria-label="Send reply"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
