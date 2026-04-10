import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const todayStr = new Date().toISOString().split("T")[0];

    // Check if report already exists for today
    const { data: existing } = await supabase
      .from("shift_reports")
      .select("id")
      .eq("report_date", todayStr)
      .eq("report_type", "shift-summary")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: "Report already exists for today", id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's orders
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", `${todayStr}T00:00:00`)
      .lte("created_at", `${todayStr}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(200);

    // Fetch today's bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", todayStr)
      .limit(100);

    const allOrders = orders || [];
    const allBookings = bookings || [];

    const completed = allOrders.filter((o: any) => o.status === "completed");
    const revenue = allOrders
      .filter((o: any) => ["completed", "ready", "preparing"].includes(o.status))
      .reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);

    // Item frequency
    const itemCounts: Record<string, number> = {};
    for (const o of allOrders) {
      if (Array.isArray((o as any).items)) {
        for (const it of (o as any).items) {
          const name = it?.name?.trim() || "Unknown";
          const qty = Number(it?.qty) > 0 ? Number(it.qty) : 1;
          itemCounts[name] = (itemCounts[name] || 0) + qty;
        }
      }
    }
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => `${name}: ${count}x`);

    // Hour distribution
    const hourCounts: Record<number, number> = {};
    for (const o of allOrders) {
      const h = new Date((o as any).created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    const avgOrderValue = allOrders.length > 0 ? Math.round(revenue / allOrders.length) : 0;
    const arrivedBookings = allBookings.filter((b: any) => b.status === "arrived" || b.status === "seated").length;
    const cancelledBookings = allBookings.filter((b: any) => b.status === "cancelled").length;
    const totalGuests = allBookings.reduce((s: number, b: any) => s + ((b as any).guests || 0), 0);

    const dataContext = `
DAILY CLOSING REPORT — ${todayStr}

ORDERS:
- Total orders today: ${allOrders.length}
- Completed: ${completed.length}
- Total revenue: N$${revenue.toLocaleString()}
- Average order value: N$${avgOrderValue}
- Peak hour: ${peakHour ? `${String(peakHour[0]).padStart(2, "0")}:00 (${peakHour[1]} orders)` : "N/A"}

TOP ITEMS: ${topItems.length > 0 ? topItems.join(", ") : "No data"}

BOOKINGS:
- Total bookings: ${allBookings.length}
- Guests expected: ${totalGuests}
- Arrived/Seated: ${arrivedBookings}
- Cancelled: ${cancelledBookings}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are the AI operations analyst for Berrylicious, a premium restaurant in Windhoek, Namibia. Write a comprehensive end-of-day shift report for the restaurant manager. Include: Executive Summary, Revenue Analysis, Kitchen Performance, Booking Insights, Top Performers (items), Concerns & Observations, and Tomorrow's Recommendations. Use N$ for currency. Be data-driven but concise (under 400 words). Use markdown with headers and bullet points.`,
          },
          {
            role: "user",
            content: `Generate the daily closing shift report.\n\n${dataContext}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "No analysis available.";

    const metadata = {
      total_orders: allOrders.length,
      completed_orders: completed.length,
      revenue,
      avg_order_value: avgOrderValue,
      total_bookings: allBookings.length,
      total_guests: totalGuests,
      peak_hour: peakHour ? `${peakHour[0]}:00` : null,
      top_items: topItems.slice(0, 5),
    };

    // Store the report
    const { data: report, error: insertError } = await supabase
      .from("shift_reports")
      .insert({
        report_date: todayStr,
        report_type: "shift-summary",
        content,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(insertError.message);
    }

    return new Response(JSON.stringify({ success: true, report_id: report.id, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-shift-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
