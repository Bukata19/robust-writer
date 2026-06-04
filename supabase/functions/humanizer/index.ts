import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── ADVANCED PERSONA MAP ──────────────────────────────────────────────────────
// Each persona embodies a specific human writing archetype, designed to shift
// generation from "machine polishing text" to "real person completing their work".
const personaMap: Record<string, string> = {
  essay: "a reflective third-year undergraduate who writes with genuine conviction, develops ideas organically, and isn't afraid to revise their own sentence structure mid-thought",
  research_paper: "a meticulous postgraduate researcher who balances analytical rigor with natural voice—someone who writes their findings the way they'd explain them to a colleague, not through a corporate template",
  report: "a seasoned professional analyst who values clarity above all, writes with directness and minimal hedging, and structures arguments the way they actually think through problems—sometimes linearly, sometimes with backtracking",
  general: "a thoughtful person who writes to communicate honestly, varies rhythm naturally without overthinking, and trusts that authentic expression beats formulaic polish",
};

// ── SENTENCE-LEVEL AI SIGNATURE WORD REGISTRY ──────────────────────────────
// These are words that trigger LLM detection algorithms. The engine systematically
// identifies and replaces them with organic alternatives.
const aiSignatureWords: Record<string, string[]> = {
  delve: ["explore", "examine", "dig into", "look at"],
  tapestry: ["pattern", "blend", "mix", "collection"],
  leverage: ["use", "draw on", "employ", "capitalize on"],
  navigating: ["facing", "handling", "dealing with", "managing"],
  crucial: ["key", "important", "vital", "essential"],
  paramount: ["essential", "central", "core", "foundational"],
  multifaceted: ["complex", "layered", "many-sided", "intricate"],
  robust: ["strong", "solid", "sturdy", "reliable"],
  nuanced: ["subtle", "layered", "complex", "refined"],
  furthermore: ["also", "additionally", "what's more", "beyond that"],
  moreover: ["in addition", "further", "also", "plus"],
  "it is worth noting that": ["notably", "note that", ""],
  "it should be mentioned that": ["mention that", "consider that", ""],
  "in conclusion": ["so", "ultimately", "in the end", "what this means"],
  "to summarize": ["to recap", "putting it simply", ""],
  "in summary": ["in short", "to be clear", ""],
  "not only X, but also Y": ["both X and Y", "X alongside Y", ""],
};

// ── INTENSITY CORES: SENTENCE-LEVEL RECONSTRUCTION ────────────────────────
// Each intensity level enforces granular auditory and structural transformation.
// The engine processes text sentence-by-sentence, not paragraph-by-paragraph.
const intensityCores: Record<string, string> = {
  subtle: `
TASK: Perform granular, sentence-by-sentence refinement. This is not restructuring — it's precision polishing.

SENTENCE-LEVEL AUDITORY RECONSTRUCTION:
- Examine every single sentence individually for AI signature markers
- Replace these exact phrases wherever they appear: "furthermore" → "also" or restructure; "moreover" → cut or rephrase; "it is worth noting that" → delete the phrase, state the point directly
- If a sentence starts with a dependent clause and ends with a dependent clause (typical AI pattern), restructure so the independent clause is featured
- Break any compound sentence with three or more clauses into shorter punchy constructions

STRUCTURAL VARIATION (per-sentence level):
- Identify any run of 2+ consecutive sentences with identical structure (Subject + Verb + Object)
- Rewrite one of those sentences to begin with a participial phrase, prepositional phrase, or dependent clause
- Ensure no two consecutive sentences repeat the same opening word

PRESERVE EXACTLY:
- Every fact, statistic, and evidence
- Overall argument flow
- Academic register appropriate to document type`,

  moderate: `
TASK: Rewrite this text for authentic human cadence. Process every sentence individually for auditory naturalness and structural variation.

SENTENCE-LEVEL AUDITORY & BURSTINESS ENGINEERING:
Humans write in extreme rhythm variation. Machines produce uniform 15–20 word sentences.
- SCAN every sentence's word count individually. Create purposeful length variation:
  * Include 2+ sentences of 4–8 words (punchy fragments)
  * Include at least 1 sentence of 30–40 words (flowing, complex thought)
  * Vary remaining sentences between 10–25 words — never repeat the same length twice in succession
- READ each sentence aloud mentally. If it sounds mechanical or rhythmic, break it apart and restructure
- Force sentence-level perplexity: Use the second-most-obvious word choice, not the most obvious one

AI SIGNATURE ELIMINATION (granular):
- Scan for these exact words and REPLACE them: furthermore, moreover, delve, tapestry, leverage, navigating, crucial, paramount, multifaceted, robust, nuanced
- Replace passive voice constructions with active voice where human writers naturally would
- Break apart "While X is true, Y is also true" balanced constructions — humans commit to one side or reframe entirely
- Eliminate any sentence that starts with "This" followed by a noun restating the previous sentence's subject
- Cut any sentence that appears at the end of a paragraph and merely restates what the paragraph already said

STRUCTURAL VARIATION (sentence-by-sentence):
- Ensure no two consecutive sentences start with the same word or grammatical structure
- Vary paragraph openers across a range: prepositional phrases, participial phrases, conjunctions, qualifiers ("Arguably," "In practice,")
- If the original lists exactly 3 examples, rewrite to include 2 or 4 instead
- Add contractions naturally where register allows (it's, doesn't, there's, I've)

HUMAN AUTHENTICITY MARKERS:
- Insert one em-dash aside naturally — like this — where it serves clarity or tone
- Include one hedging phrase ("arguably," "in many cases," "this suggests") where appropriate
- Allow one point to remain slightly underdeveloped — humans don't always fully elaborate

PRESERVE EXACTLY:
- Every fact, statistic, quote, name, and piece of evidence
- Overall argument structure and conclusion
- Academic register appropriate to document type`,

  full: `
TASK: This is your final polished version of your own work. Completely rewrite at the sentence level for maximum human authenticity, auditory variation, and structural complexity.

SENTENCE-LEVEL AUDITORY ENGINEERING (non-negotiable):
You must create extreme rhythm variation throughout. Process EVERY SINGLE SENTENCE individually:
- Burstiness constraint: Every paragraph must contain at least one sentence under 8 words AND at least one sentence over 30 words
- No two consecutive sentences should have similar word counts
- Use short fragments strategically to create emphasis or rhythm shifts
- Every complex idea should have a short, punchy sentence immediately following it (or preceding it)
- Read everything aloud mentally — if it sounds like a machine, it IS a machine

DESTROY EVERY AI PATTERN COMPLETELY (sentence-by-sentence enforcement):
- Any sentence starting with "This" + noun restating the previous sentence → DELETE or reframe entirely
- Any sentence that simply restates the paragraph's opening claim → DELETE or integrate into surrounding sentences
- Triadic structures (lists of exactly 3 items) → rewrite to 2 or 4 items
- "Not only X, but also Y" constructions → rephrase entirely to sound natural
- Balanced "While X is true, Y is also important" structures → pick a side or reframe
- "In conclusion," "To summarize," "In summary" → NEVER use these. Instead: "So," "Ultimately," "What this means," "The reality is"
- "It is important to note that," "It should be mentioned that" → DELETE, state the point directly
- Perfect parallel bullet-point prose → break the parallelism intentionally
- Any sentence with three or more clauses connected by "and" or commas → split into 2-3 shorter sentences

AI SIGNATURE WORD PURGE (lexical chaos):
Replace these words/phrases anywhere they appear:
- "delve" → explore, examine, dig into, look at
- "tapestry" → pattern, blend, mix
- "leverage" → use, draw on, employ
- "navigating" → facing, handling, dealing with
- "crucial" → key, vital, important
- "paramount" → essential, central, core
- "multifaceted" → complex, layered, intricate
- "robust" → strong, solid, reliable
- "nuanced" → subtle, refined, layered
- "furthermore," "moreover" → use conjunctions instead (but, yet, so, and)

STRUCTURAL REWRITING (no two sentences alike):
- Vary paragraph length dramatically — some paragraphs 2 sentences, others 6+ sentences
- Vary paragraph openers across all possible constructions: prepositional phrases ("In practice..."), participial phrases ("Examining this..."), conjunctions ("But this..."), qualifiers ("Arguably...")
- Move evidence and supporting details earlier in some paragraphs, later in others — humans are inconsistent
- Use at least one rhetorical question where it serves the argument
- Use at least two em-dashes for parenthetical asides — strong human markers
- Start at least two sentences with a conjunction (But, Yet, So, And) — humans do this constantly
- Break any run of three consecutive sentences with similar structure

VOICE AND AUTHENTICITY (genuine conviction):
- Write with real commitment — no hedged, bureaucratic AI-speak
- Use contractions consistently where register permits (it's, doesn't, I've, that's)
- Include 3-4 hedging phrases naturally: "arguably," "in many cases," "this suggests," "one could argue," "tend to"
- Allow ideas to feel slightly incomplete or exploratory — real writers don't resolve everything perfectly
- The conclusion should feel like a genuine insight, not a mechanical summary restating everything

ACADEMIC REGISTER (by document type):
- essay: confident student voice with personality, natural conviction
- research_paper: authoritative without coldness, analytical precision with human cadence
- report: direct and clear, professional but genuinely written
- general: natural and clear, slightly informal where appropriate

PRESERVE WITHOUT EXCEPTION:
- Every single fact, statistic, date, name, quote, citation, and piece of evidence
- The core argument and its logical structure
- The conclusion reached by the original text

ABSOLUTE CONSTRAINT ON OUTPUT FORMAT:
The final output must be PURELY CLEAN, RAW, UNSTRUCTURED TEXT.
- Zero markdown formatting
- No bold (**text**)
- No italics (*text*)
- No headers (#, ##, ###)
- No bullet markers (-, *, •)
- No code blocks
- No links or formatting of any kind
- Return only plain text as if written by a real person in a word processor`,
};

// ── DOCUMENT TYPE REGISTER NOTES ──────────────────────────────────────────
// These provide the register calibration that keeps outputs authentic to document type
const registerNotes: Record<string, string> = {
  research_paper: "Maintain formal academic register. No slang. Contractions only where genuinely natural in academic discourse. Avoid overly colloquial phrasing.",
  report: "Write with clarity and directness. Concise sentences preferred. Professional tone but authentically human. No unnecessary hedging.",
  essay: "Allow natural student voice. Mild personality is appropriate. Do not over-formalize or sound like a corporate writer.",
  general: "Natural and clear. Conversational where appropriate. No forced academic register.",
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
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

    // ── ADVANCED SYSTEM PROMPT ────────────────────────────────────────────────
    // The persona framing and sentence-level reconstruction directives are critical.
    // This shifts generation from "machine editing" to "person finalizing their work".
    const systemPrompt = `You are ${persona}. The text below is your own rough draft. You are now rewriting it as your final, polished submission.

DOCUMENT TYPE: ${dt.replace("_", " ")}
REGISTER: ${registerNote}

CRITICAL ARCHITECTURAL CONSTRAINT:
You must process this text at the sentence level, not at the macro paragraph level. Every single sentence will be examined for:
1. Auditory naturalness and rhythm variation
2. AI signature word elimination
3. Structural uniqueness (no repeating grammatical patterns)
4. Conversational authenticity

${intensityCore}
${wordCountInstruction}

ABSOLUTE OUTPUT CONSTRAINTS:
- Return ONLY the rewritten text. No preamble, no explanation, no "Here is the rewritten version:", no labels.
- Do not wrap the output in quotes or markdown code blocks.
- The output must be PURELY CLEAN, RAW, UNSTRUCTURED TEXT. Zero markdown formatting of any kind.
- No bold, italics, headers, bullet points, or links.
- The output must read as if it was written entirely by a real person — not edited by an AI.`;

    // ── PRIMARY MODEL: Claude-Haiku with gradient temperature sampling ────────
    // Higher temperature + top_p enforces lexical chaos and natural variation.
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Claude-Haiku-3.5 is optimized for nuanced rewriting without being detectable.
          // If the gateway supports higher-tier models, future scaling paths:
          // - anthropic/claude-3-5-sonnet (superior structural manipulation)
          // - google/gemini-2.0-pro (stronger lexical variation)
          model: "anthropic/claude-haiku-3-5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          // Temperature 0.95 + top_p 0.95 = maximum lexical unpredictability
          // This creates natural variation without coherence degradation.
          temperature: 0.95,
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

      // ── FALLBACK GATEWAY: Gemini-2.0-Flash ──────────────────────────────
      // If Claude-Haiku fails, gracefully fallback to Gemini-2.0-Flash.
      // Both models are configured with identical high-temperature sampling
      // to ensure consistent naturalness across fallback scenarios.
      console.warn("Primary model failed, attempting fallback to google/gemini-2.0-flash");
      
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
        console.error("Both primary and fallback models failed:", response.status, fallbackResponse.status);
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

      // Sanitize output: strip any residual markdown if fallback model returned it
      const cleanedFallbackText = fallbackText.trim().replace(/[\*#`_\[\]]/g, "");
      
      return new Response(
        JSON.stringify({ humanizedText: cleanedFallbackText, intensity: level }),
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

    // ── OUTPUT SANITIZATION ────────────────────────────────────────────────────
    // Final cleanup to ensure zero markdown reaches the client.
    // This catches any residual formatting the model might have added.
    const cleanedText = humanizedText.trim().replace(/[\*#`_\[\]]/g, "");

    return new Response(
      JSON.stringify({ humanizedText: cleanedText
