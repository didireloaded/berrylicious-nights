import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Static menu (kept in sync with src/data/menu.ts) ── */
const STATIC_MENU = [
  { name: "Beef Carpaccio", price: 95, category: "Starters", description: "Thinly sliced beef, balsamic glaze, rocket, shaved parmesan" },
  { name: "Salmon Tartare", price: 110, category: "Starters", description: "Fresh salmon, capers, red onion, dill, house sauce" },
  { name: "Avocado, Prawn & Bacon Bruschetta", price: 105, category: "Starters", description: "Toasted sourdough, creamy avo, tiger prawns, crispy bacon" },
  { name: "Salmon Sashimi Salad", price: 130, category: "Salads", description: "Sashimi-grade salmon, mixed greens, sesame dressing, pickled ginger" },
  { name: "Tofu Bowl", price: 95, category: "Salads", description: "Pan-seared tofu, brown rice, edamame, cucumber, miso glaze" },
  { name: "Tomahawk Steak", price: 420, category: "Mains", description: "800g bone-in ribeye, chimichurri, roasted garlic butter, seasonal sides" },
  { name: "Baby Chicken", price: 175, category: "Mains", description: "Spatchcock poussin, lemon herb marinade, roasted vegetables, jus" },
  { name: "Lamb Chops", price: 295, category: "Mains", description: "Herb-crusted lamb cutlets, roasted vegetables, red wine jus" },
  { name: "The Licious Burger", price: 115, category: "Burgers", description: "Teriyaki chicken breast, caramelised onions, creamy avocado, brioche bun" },
  { name: "Butternut & Feta", price: 55, category: "Sides", description: "Roasted butternut, crumbled feta, honey glaze, fresh herbs" },
  { name: "Teriyaki Broccoli", price: 55, category: "Sides", description: "Tenderstem broccoli, teriyaki glaze, toasted almond flakes" },
  { name: "Chorizo Rice", price: 60, category: "Sides", description: "Fragrant saffron rice, Spanish chorizo, fresh herbs" },
  { name: "Whiskey Crème Brûlée", price: 85, category: "Desserts", description: "Classic custard with a whiskey twist, caramelised sugar, chocolate soil" },
  { name: "Vanilla Panna Cotta", price: 80, category: "Desserts", description: "Silky vanilla panna cotta, chocolate soil, fresh berry coulis" },
  { name: "Espresso Martini", price: 95, category: "Drinks", description: "Vodka, fresh espresso, coffee liqueur, vanilla — shaken cold" },
  { name: "Mango Sunrise", price: 90, category: "Drinks", description: "Tequila, fresh mango, lime, grenadine, Tajín rim" },
  { name: "House Red Wine", price: 75, category: "Drinks", description: "Curated South African red, full-bodied, smooth finish" },
  { name: "House White Wine", price: 75, category: "Drinks", description: "Crisp South African white, refreshing and fruit-forward" },
  { name: "Classic Mojito", price: 85, category: "Drinks", description: "White rum, fresh mint, lime, soda — Berrylicious style" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Build dynamic knowledge base ──────────────────────────

    // 1. Menu — check disabled items
    const { data: disabledItems } = await supabase
      .from("menu_item_disabled")
      .select("menu_item_id");
    const disabledIds = new Set((disabledItems ?? []).map((d: any) => d.menu_item_id));

    const menuText = STATIC_MENU
      .map((item) => {
        const available = !disabledIds.has(item.name);
        return `- ${item.name} (N$${item.price}, ${item.category})${available ? "" : " [SOLD OUT]"}: ${item.description}`;
      })
      .join("\n");

    // 2. Active events & updates
    const { data: updates } = await supabase
      .from("updates")
      .select("title, subtitle, type, event_date, event_time")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(15);

    const eventsText = (updates ?? []).length > 0
      ? (updates ?? []).map((u: any) => {
          let line = `- ${u.title}`;
          if (u.subtitle) line += `: ${u.subtitle}`;
          if (u.event_date) line += ` (${u.event_date}${u.event_time ? " at " + u.event_time : ""})`;
          return line;
        }).join("\n")
      : "No special events currently scheduled.";

    // 3. User profile context (if logged in)
    let userContext = "";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, total_orders, favorite_items")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile) {
        userContext = `\nGUEST INFO: Name: ${profile.display_name || "Guest"}. Previous orders: ${profile.total_orders || 0}.`;
        if (profile.favorite_items?.length) {
          userContext += ` Favorites: ${(profile.favorite_items as string[]).join(", ")}.`;
        }
      }

      // Check active bookings
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: bookings } = await supabase
        .from("bookings")
        .select("date, time, guests, status")
        .eq("user_id", userId)
        .gte("date", todayStr)
        .eq("status", "confirmed")
        .limit(3);

      if (bookings?.length) {
        userContext += `\nUpcoming bookings: ${bookings.map((b: any) => `${b.date} at ${b.time} for ${b.guests} guests`).join("; ")}.`;
      }

      // Check active orders
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("status, items, total")
        .eq("user_id", userId)
        .in("status", ["pending", "preparing", "ready"])
        .limit(3);

      if (activeOrders?.length) {
        userContext += `\nActive orders: ${activeOrders.map((o: any) => `${o.status} — N$${o.total}`).join("; ")}.`;
      }
    }

    // 4. Current time context
    const now = new Date();
    const windhoekTime = now.toLocaleString("en-GB", { timeZone: "Africa/Windhoek", weekday: "long", hour: "2-digit", minute: "2-digit" });

    const systemPrompt = `You are a friendly, knowledgeable team member at Berrylicious — a premium Mediterranean restaurant in Windhoek, Namibia.

CRITICAL RULES:
- NEVER say you are AI, a bot, a chatbot, a virtual assistant, or automated. You are simply part of the Berrylicious team.
- Speak naturally like a warm, professional restaurant host. Use first person ("we", "our", "I'd recommend").
- Be concise — 1-3 sentences max unless the guest needs detailed info.
- Use N$ for all prices.
- If an item is marked [SOLD OUT], let the guest know and suggest an alternative.
- If you don't know something specific (like exact allergen info), say "Let me check with the kitchen" or "I'll get one of the team to confirm."
- For bookings, guide them to use the booking page or offer to help.
- Be warm, not robotic. Use casual luxury language.

CURRENT CONTEXT:
Time: ${windhoekTime}
${userContext}

FULL MENU:
${menuText}

EVENTS & HAPPENINGS:
${eventsText}

RESTAURANT INFO:
- Location: Windhoek, Namibia
- Cuisine: Mediterranean with local flair
- Vibe: Premium casual dining, great for dates, celebrations, group dinners
- Instagram: @berrylicious__restaurant
- Booking: Available through our app or in person
- Hours: Open daily for lunch and dinner`;

    // ── Call AI ──────────────────────────────────────────────
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "We're a bit busy right now — try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Our messaging is temporarily down. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content || "I'll get someone from the team to help you — one moment!";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("restaurant-chat-ai error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
