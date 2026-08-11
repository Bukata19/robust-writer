// TEMPORARY diagnostic: reports the AI gateway's real status + body for each
// model id the app uses. Delete after diagnosis.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no key" }), { status: 500 });

  const models = [
    "anthropic/claude-haiku-3-5",
    "google/gemini-2.0-flash",
    "google/gemini-3.6-flash",
    "google/gemini-2.5-flash",
  ];
  const out: Record<string, unknown> = {};
  for (const model of models) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "say ok" }] }),
    });
    out[model] = { status: r.status, body: (await r.text()).slice(0, 400) };
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
