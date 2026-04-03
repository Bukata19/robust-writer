import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, intensity, docType, targetWordCount } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 25000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds 25,000 character limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const intensityPrompts: Record<string, string> = {
      subtle:
        "Make light, targeted edits to reduce AI-sounding patterns. Replace overused transition words like 'furthermore', 'moreover', 'it is worth noting', 'delve', 'crucial', and 'in conclusion' with more natural alternatives. Vary 2–3 sentence structures. Do not change the overall writing style or vocabulary significantly.",
      moderate:
        "Rewrite the text to sound naturally human-written. Eliminate all common AI giveaway phrases and patterns. Vary sentence lengths — mix short punchy sentences with longer ones. Use natural transitions instead of formal connectors. Maintain the academic register if the document type is an essay, research paper, or report. Preserve all arguments, facts, and meaning exactly.",
      full:
        "Completely rewrite in a confident, natural human voice. Aggressively remove all AI writing patterns — robotic phrasing, repetitive structure, overly formal connectors, and filler phrases. Introduce natural sentence rhythm variation, occasional first-person framing where appropriate for the document type, and genuine-sounding transitions. For academic documents maintain a scholarly tone while still sounding human. For general documents allow a more relaxed, personal voice. Preserve every key argument and fact exactly.",
    };

    const docTypeInstructions: Record<string, string> = {
      research_paper: "Maintain formal academic register throughout. Do not make the tone conversational.",
      report: "Maintain formal academic register throughout. Do not make the tone conversational.",
      essay: "Keep a confident academic tone but allow natural student voice to come through.",
      general: "A relaxed, natural everyday writing voice is appropriate.",
    };

    const level = intensity && intensityPrompts[intensity] ? intensity : "moderate";
    const dt = docType && docTypeInstructions[docType] ? docType : "general";

    let intensityInstruction = intensityPrompts[level];
    intensityInstruction += " " + docTypeInstructions[dt];

    if (targetWordCount && typeof targetWordCount === "number" && targetWordCount > 0) {
      intensityInstruction += ` The output must be approximately ${targetWordCount} words long. Expand or compress the content naturally to meet this target while preserving all key arguments and meaning.`;
    }

    const systemPrompt = `You are a text humanizer. Your job is to rewrite academic/AI-generated text to sound more naturally human-written.

Rules:
- ${intensityInstruction}
- Preserve the original meaning, facts, and arguments exactly
- Do NOT add new information or opinions
- Return ONLY the rewritten text with no explanations, preambles, or meta-commentary`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const humanizedText = data.choices?.[0]?.message?.content ?? "";

    if (!humanizedText || humanizedText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Humanizer returned an empty response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ humanizedText, intensity: level }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("humanizer error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
