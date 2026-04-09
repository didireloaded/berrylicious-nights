import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orders, bookings, type = "shift-summary" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build context from the data
    const todayStr = new Date().toISOString().split("T")[0];
    const todayOrders = (orders || []).filter((o: any) => String(o.created_at).startsWith(todayStr));
    const completedToday = todayOrders.filter((o: any) => o.status === "completed");
    const pendingCount = (orders || []).filter((o: any) => o.status === "pending").length;
    const preparingCount = (orders || []).filter((o: any) => o.status === "preparing").length;
    const readyCount = (orders || []).filter((o: any) => o.status === "ready").length;
    const todayBookings = (bookings || []).filter((b: any) => b.date === todayStr);

    const revenue = todayOrders
      .filter((o: any) => ["completed", "ready", "preparing"].includes(o.status))
      .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

    // Item frequency
    const itemCounts: Record<string, number> = {};
    for (const o of orders || []) {
      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          const name = it?.name?.trim() || "Unknown";
          const qty = Number(it?.qty) > 0 ? Number(it.qty) : 1;
          itemCounts[name] = (itemCounts[name] || 0) + qty;
        }
      }
    }
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => `${name}: ${count}x`);

    // Hour distribution
    const hourCounts: Record<number, number> = {};
    for (const o of orders || []) {
      const h = new Date(o.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Booking stats
    const arrivedBookings = todayBookings.filter((b: any) => b.status === "arrived" || b.status === "seated").length;
    const cancelledBookings = todayBookings.filter((b: any) => b.status === "cancelled").length;
    const totalGuests = todayBookings.reduce((s: number, b: any) => s + (b.guests || 0), 0);

    // Average order value
    const avgOrderValue = todayOrders.length > 0 ? Math.round(revenue / todayOrders.length) : 0;

    const dataContext = `
RESTAURANT DATA SNAPSHOT (${new Date().toLocaleString("en-GB", { timeZone: "Africa/Windhoek" })}):

ORDERS:
- Total all-time orders in system: ${(orders || []).length}
- Today's orders: ${todayOrders.length}
- Completed today: ${completedToday.length}
- Currently pending: ${pendingCount}
- Currently preparing: ${preparingCount}
- Currently ready for pickup: ${readyCount}
- Today's revenue: N$${revenue.toLocaleString()}
- Average order value today: N$${avgOrderValue}
- Peak hour: ${peakHour ? `${String(peakHour[0]).padStart(2, "0")}:00 (${peakHour[1]} orders)` : "N/A"}

TOP ITEMS (all-time): ${topItems.length > 0 ? topItems.join(", ") : "No data"}

BOOKINGS:
- Today's bookings: ${todayBookings.length}
- Guests expected: ${totalGuests}
- Arrived/Seated: ${arrivedBookings}
- Cancelled: ${cancelledBookings}
- All-time bookings: ${(bookings || []).length}
`;

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "shift-summary") {
      systemPrompt = `You are the AI operations analyst for Berrylicious, a premium restaurant in Windhoek, Namibia. You provide concise, actionable shift summaries for the restaurant manager. Use a warm but professional tone. Use N$ for currency. Keep it under 250 words. Use markdown formatting with headers and bullet points.`;
      userPrompt = `Based on this data, write a shift summary covering: performance highlights, areas of concern, kitchen efficiency, and 2-3 actionable recommendations.\n\n${dataContext}`;
    } else if (type === "kitchen-report") {
      systemPrompt = `You are the AI kitchen analyst for Berrylicious restaurant. You analyze kitchen performance and give tactical advice. Be specific and data-driven. Use N$ for currency. Keep under 200 words. Use markdown.`;
      userPrompt = `Generate a kitchen performance report with: throughput analysis, bottleneck identification, item popularity insights, and prep optimization tips.\n\n${dataContext}`;
    } else if (type === "revenue-report") {
      systemPrompt = `You are the AI revenue analyst for Berrylicious restaurant. You analyze financial performance and identify opportunities. Use N$ for currency. Keep under 200 words. Use markdown.`;
      userPrompt = `Generate a revenue report with: revenue breakdown, average order value analysis, peak revenue periods, upsell opportunities, and revenue projections for the rest of the shift.\n\n${dataContext}`;
    } else if (type === "recommendations") {
      systemPrompt = `You are an AI restaurant operations advisor for Berrylicious. Give 5 specific, actionable recommendations based on current data. Be practical and prioritized. Use markdown numbered list.`;
      userPrompt = `Based on this real-time data, give 5 prioritized recommendations to improve operations right now.\n\n${dataContext}`;
    }

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "No analysis available.";

    return new Response(JSON.stringify({ analysis: content, type, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
