import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IG_USERNAME = "berrylicious__restaurant";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try multiple public endpoints for Instagram data
    let postTexts: string[] = [];

    // Method 1: Try the public web profile page and extract from __a=1 or embedded JSON
    const endpoints = [
      `https://www.instagram.com/${IG_USERNAME}/?__a=1&__d=dis`,
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${IG_USERNAME}`,
    ];

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "X-IG-App-ID": "936619743392459",
    };

    let rawData: any = null;

    for (const url of endpoints) {
      try {
        console.log(`Trying: ${url}`);
        const res = await fetch(url, { headers });
        if (res.ok) {
          const text = await res.text();
          try {
            rawData = JSON.parse(text);
            console.log("Got JSON response from:", url);
            break;
          } catch {
            // Try to extract JSON from HTML
            const match = text.match(/window\._sharedData\s*=\s*({.+?});<\/script>/);
            if (match) {
              rawData = JSON.parse(match[1]);
              console.log("Extracted shared data from HTML");
              break;
            }
          }
        } else {
          console.log(`${url} returned ${res.status}`);
        }
      } catch (e) {
        console.log(`Failed ${url}:`, e instanceof Error ? e.message : e);
      }
    }

    // Method 2: If API endpoints fail, try fetching the page and look for meta content
    if (!rawData) {
      try {
        console.log("Trying page meta extraction...");
        const pageRes = await fetch(`https://www.instagram.com/${IG_USERNAME}/`, {
          headers: { ...headers, "Accept": "text/html" },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          // Extract all og:description and meta descriptions — these often contain recent post captions
          const metaMatches = html.match(/content="([^"]{20,})"/g) || [];
          const descriptions = metaMatches
            .map(m => m.replace(/^content="/, "").replace(/"$/, ""))
            .filter(d => d.length > 30 && !d.includes("DOCTYPE") && !d.includes("<!"));

          if (descriptions.length > 0) {
            postTexts = descriptions;
            console.log(`Extracted ${descriptions.length} meta descriptions`);
          }

          // Also look for embedded data
          const scripts = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/gs) || [];
          for (const s of scripts) {
            try {
              const json = JSON.parse(s.replace(/<script[^>]*>/, "").replace(/<\/script>/, ""));
              if (json.description) postTexts.push(json.description);
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        console.log("Page fetch failed:", e instanceof Error ? e.message : e);
      }
    }

    // Extract post captions from API data if we got it
    if (rawData) {
      try {
        const edges =
          rawData?.graphql?.user?.edge_owner_to_timeline_media?.edges ||
          rawData?.data?.user?.edge_owner_to_timeline_media?.edges ||
          [];
        for (const edge of edges.slice(0, 12)) {
          const caption = edge?.node?.edge_media_to_caption?.edges?.[0]?.node?.text;
          if (caption) postTexts.push(caption);
        }
        console.log(`Extracted ${postTexts.length} captions from API`);
      } catch (e) {
        console.log("Failed to extract captions:", e);
      }
    }

    if (postTexts.length === 0) {
      console.log("No content could be extracted from Instagram");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Could not access Instagram content. The page may require login or is rate-limited. Try again later.",
          events_added: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to extract events
    const combinedText = postTexts.join("\n---\n").slice(0, 8000);
    console.log(`Sending ${combinedText.length} chars to AI for extraction`);

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
            content: `You extract event and show information from restaurant Instagram post captions.
Return JSON: {"events":[...]}. Each event:
- "title": string (event name, max 80 chars)
- "subtitle": string (brief description, max 150 chars)
- "event_date": string (YYYY-MM-DD format, or null)
- "event_time": string (HH:MM format, or null)
- "type": always "event"

Only extract UPCOMING events, shows, live music, DJ nights, themed dinners, specials, or promotions.
Skip regular food posts. If no events, return {"events":[]}.`,
          },
          {
            role: "user",
            content: `Extract upcoming events from these Instagram posts:\n\n${combinedText}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      console.error("AI error:", aiRes.status);
      return new Response(
        JSON.stringify({ success: false, error: `Analysis failed: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: { events?: any[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { events: [] };
    }

    const events = parsed.events || [];
    console.log(`AI extracted ${events.length} events`);

    let added = 0;
    for (const evt of events) {
      if (!evt.title) continue;

      const { data: existing } = await supabase
        .from("updates")
        .select("id")
        .ilike("title", evt.title.trim())
        .maybeSingle();

      if (existing) continue;

      const { error: insErr } = await supabase.from("updates").insert({
        title: evt.title.trim(),
        subtitle: evt.subtitle?.trim() || null,
        type: "event",
        event_date: evt.event_date || null,
        event_time: evt.event_time || null,
        active: true,
        expires_at: evt.event_date || null,
      });

      if (!insErr) added++;
      else console.error(`Insert failed for "${evt.title}":`, insErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: added > 0 ? `Found ${added} new events from Instagram` : "No new events found",
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
