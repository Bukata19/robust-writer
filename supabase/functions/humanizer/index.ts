import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── PERSONA MAP ────────────────────────────────────────────────────────────
// Giving the model a concrete human writer persona is the single biggest
// improvement over "You are a text humanizer". It shifts generation from
// "AI transforming AI text" to "person polishing their own work".
const personaMap: Record<string, string> = {
  essay: "a third-year undergraduate student who writes confidently and has a distinct personal voice in their academic work",
  research_paper: "a postgraduate researcher who writes with authority but retains their individual analytical voice",
  report: "a professional analyst who writes clearly and directly, with well-reasoned arguments and minimal fluff",
  general: "a knowledgeable person who writes naturally and conversationally without being informal",
};

// ── INTENSITY CORES ────────────────────────────────────────────────────────
const intensityCores: Record<string, string> = {
  subtle: `
TASK: Make targeted refinements only. Do not restructure.

APPLY THESE SPECIFIC CHANGES:
- Replace these exact words wherever they appear: "furthermore" → use "also" or restructure the sentence; "moreover" → cut or rephrase; "it is worth noting that" → delete, state the point directly; "delve" → use "explore" or "examine"; "crucial" → use "important" or "key"; "in conclusion" → use "ultimately" or restructure; "utilize" → use "use"; "paramount" → use "essential" or "critical"; "multifaceted" → be specific about what the complexity actually is
- Change 2–3 sentences that follow identical structures (e.g. three consecutive Subject + Verb + Object sentences) — vary one to start with a participial phrase or prepositional phrase
- If any paragraph has a final sentence that restates the paragraph's opening claim, cut or reframe that sentence
- Keep everything else exactly as it is`,

  moderate: `
TASK: Rewrite the text so it reads as natural, authentic student writing.

BURSTINESS (top priority):
AI text has consistent sentence length (15–20 words each). Humans do not write this way.
You must create dramatic length variation in every paragraph:
- Include at least 2 sentences of 4–8 words per 200 words of text
- Include at least 1 sentence of 30–40 words per 200 words of text
- The remaining sentences should vary between 10–25 words
- Never write three consecutive sentences of similar length

STRUCTURAL VARIATION:
- Do not start two consecutive paragraphs with a subject + verb opening
- Vary paragraph openers: use participial phrases ("Examining this further..."), prepositional phrases ("In practice,..."), conjunctions to start ("But this creates..."), qualifiers ("Arguably,..."), or direct short statements
- Break the AI triad pattern: if the original lists exactly 3 examples or makes exactly 3 points, adjust to 2 or 4
- Remove any paragraph-ending sentence that simply restates what the paragraph already said

WORD CHOICE:
- Remove all of these words and replace them specifically: furthermore, moreover, it is worth noting, delve, crucial, paramount, multifaceted, robust, leverage (as a verb), nuanced (unless genuinely needed), comprehensive, in today's world, in conclusion, to summarize, in summary
- Choose the second-most-obvious synonym rather than the most obvious one — this increases perplexity and reduces AI detection scores
- Introduce occasional contractions where the register allows (it's, doesn't, there's)

HUMAN AUTHENTICITY MARKERS:
- Add one em-dash aside somewhere — like this — where it naturally fits
- Include one hedging phrase ("arguably", "in many cases", "this suggests") where appropriate
- Allow one point to be slightly underdeveloped — humans do not always fully elaborate every claim

PRESERVE EXACTLY:
- Every fact, statistic, quote, and piece of evidence
- The overall argument structure and conclusion
- Academic register appropriate to the document type`,

  full: `
TASK: Completely rewrite this in an authentic, natural human voice. This is your own work — you wrote a rough draft and you are now producing your polished final version.

BURSTINESS (non-negotiable):
Create extreme sentence length variation throughout:
- Every paragraph must contain at least one sentence under 8 words
- Every paragraph must contain at least one sentence over 30 words  
- Sentence lengths should feel rhythmic and intentional, not random
- Read it aloud in your head — if it sounds like a robot, fix it

DESTROY THESE AI PATTERNS COMPLETELY:
- Triadic structures (lists of exactly 3) — use 2 or 4 instead
- "Not only X, but also Y" — rephrase entirely
- "While X is true, Y is also important" balanced constructions — pick a side or reframe
- Paragraph-final summary sentences — end paragraphs on a thought, not a restatement
- "In conclusion" / "To summarize" / "In summary" — never use these
- "It is important to note that" / "It should be mentioned that" — delete, state directly
- Perfect parallel bullet-point-style prose — break the parallelism intentionally
- Any sentence that starts with "This" followed by a noun restating the previous sentence's subject

STRUCTURAL REWRITING:
- Vary paragraph length — not every paragraph should be 3–4 sentences
- Move evidence earlier in some paragraphs, later in others — humans are inconsistent
- Allow one paragraph to make its point in 2 sentences and another to develop over 6
- Use at least one rhetorical question where it serves the argument naturally
- Use at least two em-dashes for parenthetical asides — they are strong human markers
- Start at least one sentence with a conjunction (But, Yet, So, And) — humans do this

VOICE AND AUTHENTICITY:
- Write with genuine conviction — not hedged, bureaucratic AI-speak
- Use contractions consistently where the register permits
- Include hedging language (arguably, in many cases, this suggests, one could argue) 2–3 times
- Allow one idea to feel slightly incomplete — real writers do not perfectly resolve everything
- The conclusion should feel like a genuine takeaway, not a mechanical summary

ACADEMIC REGISTER (by doc type):
- essay: confident student voice, some personality allowed
- research_paper: authoritative but not sterile, analytical precision with human cadence  
- report: direct and clear, no fluff, but reads like a real professional wrote it
- general: natural, clear, slightly informal where appropriate

PRESERVE WITHOUT EXCEPTION:
- Every single fact, statistic, date, name, quote, and piece of evidence
- The core argument and its logical structure
- The conclusion reached by the original text`,
};

// ── DOC TYPE REGISTER NOTES ───────────────────────────────────────────────
const registerNotes: Record<string, string> = {
  research_paper: "Maintain formal academic register. No slang. Contractions only where genuinely natural in academic prose.",
  report: "Write clearly and professionally. Concise sentences preferred. No unnecessary hedging.",
  essay: "Allow a natural student voice. Mild personality is appropriate. Do not over-formalise.",
  general: "Natural, clear writing. Conversational where appropriate. No need for academic register.",
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

    const level = intensity && intensityCores[intensity] ? intensity : "moderate";
    const dt = docType && personaMap[docType] ? docType : "general";

    const persona = personaMap[dt];
    const intensityCore = intensityCores[level];
    const registerNote = registerNotes[dt];

    let wordCountInstruction = "";
    if (targetWordCount && typeof targetWordCount === "number" && targetWordCount > 0) {
      wordCountInstruction = `\nTARGET LENGTH: Approximately ${targetWordCount} words. Expand or compress naturally — do not pad with filler or cut key arguments to hit this number.`;
    }

    // ── SYSTEM PROMPT ──────────────────────────────────────────────────────
    // The persona framing at the top is critical — it makes the model generate
    // from a "human author" frame rather than an "AI editor" frame.
    const systemPrompt = `You are ${persona}. The text below is your own rough draft. You are now rewriting it as your final, polished submission.

DOCUMENT TYPE: ${dt.replace("_", " ")}
REGISTER: ${registerNote}

${intensityCore}
${wordCountInstruction}

FINAL RULES:
- Return ONLY the rewritten text. No preamble, no explanation, no "Here is the rewritten version:", no labels.
- Do not wrap the output in quotes or markdown code blocks.
- The output must read as if it was written entirely by a real person — not edited by an AI.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Use a more capable model — flash/preview models produce high-coherence
          // text that AI detectors easily flag. A more capable model with higher
          // temperature produces genuinely varied, lower-perplexity outputs.
          model: "anthropic/claude-haiku-3-5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          // Higher temperature is essential for humanization.
          // 0.7 (default) = predictable = detectable.
          // 0.95 = varied word choices = lower perplexity = harder to detect.
          temperature: 0.95,
          // top_p sampling adds another layer of lexical unpredictability
          top_p: 0.95,
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

      // Fallback: if claude-haiku-3-5 is unavailable through this gateway,
      // retry with gemini-2.0-flash (significantly better than flash-preview)
      const fallbackResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            temperature: 0.95,
            top_p: 0.95,
          }),
        }
      );

      if (!fallbackResponse.ok) {
        console.error("Both model attempts failed:", response.status, fallbackResponse.status);
        return new Response(
          JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fallbackData = await fallbackResponse.json();
      const fallbackText = fallbackData.choices?.[0]?.message?.content ?? "";
      if (!fallbackText.trim()) {
        return new Response(
          JSON.stringify({ error: "Humanizer returned an empty response. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ humanizedText: fallbackText.trim(), intensity: level }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      JSON.stringify({ humanizedText: humanizedText.trim(), intensity: level }),
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
