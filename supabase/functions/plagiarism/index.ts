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

    const systemPrompt = `You are an expert academic integrity and originality analyzer. Analyze the provided text for potential plagiarism and originality concerns with nuance and precision.

You MUST respond using the "plagiarism_report" tool. Analyze the text thoroughly across MULTIPLE dimensions:

**Analysis Dimensions:**
1. **Writing Style Consistency** — Does the tone, vocabulary level, and voice remain consistent throughout? Sudden shifts in sophistication or style may indicate copied sections.
2. **Sentence Structure Variety** — Original writing tends to have natural variation in sentence length and structure. Repetitive or overly uniform patterns suggest formulaic or generated content.
3. **Vocabulary Naturalness** — Look for unnaturally sophisticated vocabulary that doesn't match the overall writing level, or overly generic "filler" phrasing typical of AI-generated text.
4. **Transition Patterns** — Original writers use diverse transitions. Overuse of "Furthermore," "Moreover," "In conclusion" etc. without variety suggests templated writing.
5. **Specificity & Personal Voice** — Original writing contains specific examples, personal perspective, and unique observations. Generic, surface-level treatment of topics is a red flag.
6. **Claim Substantiation** — Factual claims without citations or attribution in academic writing suggest unattributed borrowing.

**Scoring Guidelines (be precise, not inflated):**
- 0-15: Clean — text shows strong originality markers: consistent voice, varied structure, natural vocabulary, specific examples
- 16-40: Low risk — mostly original with minor concerns (a few common phrases or slightly formulaic sections)
- 41-70: Moderate risk — multiple passages seem derivative, noticeable style inconsistencies, or heavily formulaic structure
- 71-100: High risk — strong indicators of copying, AI generation without personalization, or significant unattributed content

**Important:** Be fair and calibrated. Academic writing naturally contains some common phrases and discipline-specific terminology. Focus on PATTERNS of unoriginality, not isolated common expressions. Give credit where the writing demonstrates genuine thought and voice.

For each flagged passage:
- Identify the exact excerpt (10-50 words)
- Classify the concern type
- Explain the specific concern clearly
- Rate severity accurately
- Provide ONE actionable suggestion to improve that specific passage

Also identify 1-2 things the writing does well in terms of originality (even in high-risk texts, find something positive).`;

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
                    originality_strengths: {
                      type: "array",
                      description: "1-2 things the writing does well in terms of originality",
                      items: { type: "string" },
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
                          suggestion: {
                            type: "string",
                            description: "One actionable tip to fix or improve this specific passage",
                          },
                        },
                        required: ["excerpt", "concern_type", "reason", "severity", "suggestion"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["overall_score", "summary", "originality_strengths", "flagged_passages"],
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
