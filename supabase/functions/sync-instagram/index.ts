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
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Scrape Instagram page via Firecrawl
    console.log("Scraping Instagram page...");
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.instagram.com/berrylicious__restaurant/",
        formats: ["markdown"],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", JSON.stringify(scrapeData));
      return new Response(
        JSON.stringify({ success: false, error: `Scrape failed: ${scrapeData.error || scrapeRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
    if (!markdown || markdown.length < 50) {
      console.log("No meaningful content scraped. Raw:", JSON.stringify(scrapeData).slice(0, 500));
      return new Response(
        JSON.stringify({ success: true, message: "No new content found", events_added: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scraped ${markdown.length} chars. Extracting events...`);

    // Step 2: Use AI to extract events/shows from the scraped content
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You extract event and show information from restaurant Instagram posts.
Return a JSON object with an "events" array. Each event has:
- "title": string (event name, max 80 chars)
- "subtitle": string (brief description, max 150 chars)  
- "event_date": string (YYYY-MM-DD format, or null if unclear)
- "event_time": string (HH:MM format, or null if unclear)
- "type": always "event"

Only extract UPCOMING events, shows, live music, DJ nights, themed dinners, specials, or promotions.
Skip regular menu posts, food photos without events, or past events.
If no events found, return {"events":[]}.
Be conservative — only include posts that clearly describe an event or show.`,
          },
          {
            role: "user",
            content: `Extract upcoming events from this Instagram content:\n\n${markdown.slice(0, 8000)}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `AI extraction failed: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: { events?: any[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON:", content.slice(0, 500));
      parsed = { events: [] };
    }

    const events = parsed.events || [];
    console.log(`Extracted ${events.length} events`);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming events found", events_added: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Upsert events into updates table (avoid duplicates by title match)
    let added = 0;
    for (const evt of events) {
      if (!evt.title) continue;

      // Check for duplicate by title (case-insensitive)
      const { data: existing } = await supabase
        .from("updates")
        .select("id")
        .ilike("title", evt.title.trim())
        .maybeSingle();

      if (existing) {
        console.log(`Skipping duplicate: ${evt.title}`);
        continue;
      }

      const { error: insErr } = await supabase.from("updates").insert({
        title: evt.title.trim(),
        subtitle: evt.subtitle?.trim() || null,
        type: "event",
        event_date: evt.event_date || null,
        event_time: evt.event_time || null,
        active: true,
        expires_at: evt.event_date || null,
      });

      if (insErr) {
        console.error(`Failed to insert event "${evt.title}":`, insErr.message);
      } else {
        added++;
        console.log(`Added event: ${evt.title}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${added} new events from Instagram`,
        events_found: events.length,
        events_added: added,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-instagram error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
