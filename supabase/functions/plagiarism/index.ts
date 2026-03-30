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

    const { text, documentId } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Text must be at least 50 characters for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 30000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds 30,000 character limit for plagiarism analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an academic integrity analyzer. Analyze the provided text for potential plagiarism and originality concerns.

You MUST respond using the "plagiarism_report" tool. Analyze the text thoroughly and provide:

1. An overall risk score from 0-100 (0 = fully original, 100 = likely plagiarized)
2. A list of flagged passages with specific concerns

Scoring guidelines:
- 0-15: Clean — text appears original and well-written
- 16-40: Low risk — minor concerns, possibly common phrasing
- 41-70: Moderate risk — several passages seem derivative or overly formulaic
- 71-100: High risk — text shows strong indicators of being copied or AI-generated without personalization

For each flagged passage, identify:
- The exact text excerpt (10-50 words)
- The type of concern: "common_phrasing", "formulaic_structure", "ai_generated", "uncited_claim", "style_inconsistency"
- A brief reason explaining the concern
- A severity: "low", "medium", or "high"

Be thorough but fair. Academic writing naturally contains some common phrases. Focus on passages that genuinely seem unoriginal.`;

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
          tools: [
            {
              type: "function",
              function: {
                name: "plagiarism_report",
                description: "Submit a plagiarism analysis report for the given text",
                parameters: {
                  type: "object",
                  properties: {
                    overall_score: {
                      type: "number",
                      description: "Overall plagiarism risk score from 0-100",
                    },
                    summary: {
                      type: "string",
                      description: "Brief overall assessment of the text's originality (1-3 sentences)",
                    },
                    flagged_passages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          excerpt: {
                            type: "string",
                            description: "The exact flagged text excerpt (10-50 words)",
                          },
                          concern_type: {
                            type: "string",
                            enum: [
                              "common_phrasing",
                              "formulaic_structure",
                              "ai_generated",
                              "uncited_claim",
                              "style_inconsistency",
                            ],
                          },
                          reason: {
                            type: "string",
                            description: "Brief explanation of the concern",
                          },
                          severity: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                          },
                        },
                        required: ["excerpt", "concern_type", "reason", "severity"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["overall_score", "summary", "flagged_passages"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "plagiarism_report" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Failed to parse plagiarism analysis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const report = JSON.parse(toolCall.function.arguments);
    report.overall_score = Math.max(0, Math.min(100, Math.round(report.overall_score)));

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("plagiarism error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
