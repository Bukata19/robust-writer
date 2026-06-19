import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── PERSONA MAP ────────────────────────────────────────────────────────────
const personaMap: Record<string, string> = {
  essay: "a reflective third-year undergraduate who writes with genuine conviction, develops ideas organically, and isn't afraid to revise their own sentence structure mid-thought",
  research_paper: "a meticulous postgraduate researcher who balances analytical rigor with natural voice—someone who writes their findings the way they'd explain them to a colleague, not through a corporate template",
  report: "a seasoned professional analyst who values clarity above all, writes with directness and minimal hedging, and structures arguments the way they actually think through problems—sometimes linearly, sometimes with backtracking",
  general: "a thoughtful person who writes to communicate honestly, varies rhythm naturally without overthinking, and trusts that authentic expression beats formulaic polish",
};

// ── AI SIGNATURE WORD REGISTRY ─────────────────────────────────────────────
// GAP 1 FIX: This registry is now actively used in preprocessText()
// before the text is ever sent to the AI model.
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
};

// ── GAP 1: PRE-PROCESSING ──────────────────────────────────────────────────
// Strips AI signature words BEFORE the text reaches the model.
// This is more reliable than asking the AI to do it — two-pass elimination.
function preprocessText(input: string): string {
  let result = input;
  for (const [signature, replacements] of Object.entries(aiSignatureWords)) {
    const validReplacements = replacements.filter((r) => r.length > 0);
    if (validReplacements.length === 0) continue;
    const replacement =
      validReplacements[Math.floor(Math.random() * validReplacements.length)];
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  return result;
}

// ── GAP 3: POST-PROCESSING ─────────────────────────────────────────────────
// Runs after the model responds. Catches any signature words that survived,
// strips markdown the model may have snuck in, and removes AI preambles.
function postProcessText(text: string): string {
  // Second pass on surviving signature words
  let result = preprocessText(text);

  // Strip markdown formatting
  result = result
    .replace(/\*\*([^*]+)\*\*/g, "$1")          // **bold**
    .replace(/\*([^*]+)\*/g, "$1")               // *italic*
    .replace(/#{1,6}\s+/gm, "")                  // # headers
    .replace(/^[-*•]\s+/gm, "")                  // bullet points
    .replace(/`([^`]+)`/g, "$1");                // `inline code`

  // Remove AI preambles like "Here is the rewritten version:"
  result = result.replace(
    /^(here\s+is|below\s+is|the\s+following\s+is|here's)[^:\n]*[:\n]\s*/i,
    ""
  );

  // Collapse excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

// ── GAP 6: TEXT CHUNKING ───────────────────────────────────────────────────
// Splits long texts into paragraph-respecting chunks before processing.
// This prevents uniform transformation patterns that ZeroGPT detects
// when a 2000-word document is processed as a single block.
function chunkText(text: string, maxChunkWords = 400): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).length;
    if (currentWords + paraWords > maxChunkWords && current) {
      chunks.push(current.trim());
      current = para;
      currentWords = paraWords;
    } else {
      current += (current ? "\n\n" : "") + para;
      currentWords += paraWords;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ── INTENSITY CORES ────────────────────────────────────────────────────────
// GAP 4 FIX: ZeroGPT-specific countermeasures added to all three levels.
// GAP 5 FIX: Punctuation variation instruction added to moderate and full.
const intensityCores: Record<string, string> = {
  subtle: `
TASK: Perform granular, sentence-by-sentence refinement. This is precision polishing, not restructuring.

SENTENCE-LEVEL REFINEMENT:
- Examine every sentence individually for AI signature markers
- Replace overused connectors: "furthermore" → "also" or restructure; "moreover" → cut or rephrase; "it is worth noting that" → delete the phrase and state the point directly
- If a sentence starts with a dependent clause AND ends with a dependent clause (typical AI pattern), restructure so the independent clause is featured
- Break any compound sentence with three or more clauses into shorter constructions

STRUCTURAL VARIATION:
- Identify any run of 2+ consecutive sentences with identical structure (Subject + Verb + Object)
- Rewrite one of those sentences to begin differently — a participial phrase, a prepositional phrase, or a dependent clause
- Ensure no two consecutive sentences start with the same word

ZEROGPT-SPECIFIC COUNTERMEASURES:
- Use the second or third most likely word choice at least once per paragraph — not obscure words, just slightly less predictable synonyms
- Replace at least one explicit transitional phrase ("however," "therefore") with an implicit connection where ideas flow through context instead of a connector word
- Add one brief parenthetical or slight qualification per 300 words — a realistic aside that humans include

PRESERVE EXACTLY:
- Every fact, statistic, and piece of evidence
- Overall argument flow and conclusion
- Academic register appropriate to the document type`,

  moderate: `
TASK: Rewrite this text for authentic human cadence. Process every sentence individually for auditory naturalness and structural variation.

SENTENCE-LEVEL AUDITORY ENGINEERING:
- SCAN every sentence's word count. Create purposeful length variation:
  * Include 2+ sentences of 4–8 words (punchy fragments)
  * Include at least 1 sentence of 30–40 words (flowing, complex thought)
  * Vary remaining sentences between 10–25 words — never the same length twice in succession
- READ each sentence aloud mentally. If it sounds mechanical or rhythmic, break it apart and restructure
- Use the second-most-obvious word choice occasionally — this increases perplexity scores

AI SIGNATURE ELIMINATION:
- Replace passive voice with active voice where a human writer naturally would
- Break "While X is true, Y is also true" balanced constructions — commit to one side or reframe
- Eliminate any sentence that starts with "This" followed by a noun restating the previous sentence's subject
- Cut any sentence at the end of a paragraph that merely restates what the paragraph already said
- If the original lists exactly 3 examples, rewrite to include 2 or 4 instead

STRUCTURAL VARIATION:
- No two consecutive sentences should start with the same word or grammatical structure
- Vary paragraph openers: prepositional phrases, participial phrases, conjunctions, qualifiers ("Arguably," "In practice,")
- Add contractions naturally where register allows (it's, doesn't, there's)

HUMAN AUTHENTICITY MARKERS:
- Insert one em-dash aside — like this — where it serves clarity or tone
- Include one hedging phrase ("arguably," "in many cases," "this suggests") where appropriate
- Allow one point to remain slightly underdeveloped — humans don't always fully elaborate

PUNCTUATION VARIETY:
- Use at least one semicolon where two independent clauses are conceptually linked
- Use at least two em-dashes (—) for parenthetical asides
- Allow one comma splice in informal or flowing passages — humans do this naturally

ZEROGPT-SPECIFIC COUNTERMEASURES:
- BURSTINESS: The gap between the shortest and longest sentence in every paragraph must be at least 20 words. A paragraph where all sentences are 12–18 words fails this test.
- TRANSITION DENSITY: Explicit transitional phrases ("however," "therefore," "consequently") are AI markers. Replace at least two with implicit transitions where ideas connect through context.
- COHERENCE VARIATION: Add one sentence per 250 words that is slightly tangential or parenthetical — a brief aside, a qualification, a small personal observation. Humans do this constantly. Machines never do.

PRESERVE EXACTLY:
- Every fact, statistic, quote, name, and piece of evidence
- Overall argument structure and conclusion
- Academic register appropriate to the document type`,

  full: `
TASK: This is your final polished version of your own work. Completely rewrite at the sentence level for maximum human authenticity.

SENTENCE-LEVEL AUDITORY ENGINEERING (non-negotiable):
Process EVERY SINGLE SENTENCE individually:
- Every paragraph must contain at least one sentence under 8 words AND at least one over 30 words
- No two consecutive sentences should have similar word counts
- Use short fragments for emphasis or rhythm shifts
- Every complex idea should have a short, punchy sentence immediately before or after it
- Read everything aloud mentally — if it sounds like a machine, rewrite it

DESTROY EVERY AI PATTERN (sentence-by-sentence enforcement):
- Any sentence starting with "This" + noun restating the previous sentence → DELETE or reframe
- Any sentence that restates the paragraph's opening claim → DELETE or integrate
- Triadic structures (lists of exactly 3 items) → rewrite to 2 or 4 items
- "Not only X, but also Y" → rephrase entirely
- Balanced "While X is true, Y is also important" → pick a side or reframe
- "In conclusion," "To summarize," "In summary" → NEVER use. Use: "So," "Ultimately," "What this means," "The reality is"
- "It is important to note that," "It should be mentioned that" → DELETE, state the point directly
- Any sentence with three or more clauses connected by "and" or commas → split into 2–3 shorter sentences
- AI signature words (delve, leverage, robust, multifaceted, nuanced, furthermore, moreover) → eliminate

STRUCTURAL REWRITING:
- Vary paragraph length dramatically — some 2 sentences, others 6+
- Vary paragraph openers: prepositional phrases ("In practice..."), participial phrases ("Examining this..."), conjunctions ("But this..."), qualifiers ("Arguably...")
- Move evidence earlier in some paragraphs, later in others — humans are inconsistent
- Use at least one rhetorical question where it serves the argument
- Start at least two sentences with a conjunction (But, Yet, So, And)
- Break any run of three consecutive sentences with similar structure

PUNCTUATION VARIETY:
- Use at least two semicolons connecting related independent clauses
- Use at least three em-dashes (—) for parenthetical asides or abrupt shifts
- Use a colon at least once to introduce an elaboration
- Allow one or two comma splices — humans write these, especially in flowing passages
- Vary sentence endings — not every sentence ends with a period. Use occasional questions.

ZEROGPT-SPECIFIC COUNTERMEASURES:
- PERPLEXITY: Use the second or third most likely word choice at least twice per paragraph — not obscure vocabulary, just unexpected but accurate word selections
- BURSTINESS: Statistical variance of sentence lengths must be extreme. The gap between shortest and longest sentence in every paragraph must be 25+ words minimum. A flat variance profile is ZeroGPT's clearest signal.
- TRANSITION DENSITY: Remove ALL explicit transitional phrases ("however," "therefore," "consequently," "furthermore," "thus"). Replace every one with implicit transitions where ideas connect through context and logic.
- COHERENCE BREAKS: Add two sentences per 300 words that are slightly tangential — a brief qualification, a parenthetical thought, a moment of self-correction. These destroy the machine-perfect coherence ZeroGPT detects.
- LEXICAL UNPREDICTABILITY: At least 3 times per 200 words, choose the second or third most statistically probable word instead of the most obvious one. This elevates the perplexity score that ZeroGPT measures.

VOICE AND AUTHENTICITY:
- Write with real commitment — no hedged AI-speak
- Use contractions consistently where register permits (it's, doesn't, I've, that's, there's)
- Include 3–4 hedging phrases naturally: "arguably," "in many cases," "this suggests," "one could argue," "tend to"
- Allow ideas to feel slightly incomplete or exploratory — real writers don't resolve everything perfectly
- The conclusion should feel like a genuine insight, not a mechanical summary

ACADEMIC REGISTER BY DOCUMENT TYPE:
- essay: confident student voice with personality, natural conviction
- research_paper: authoritative without coldness, analytical precision with human cadence
- report: direct and clear, professional but genuinely written
- general: natural and clear, slightly informal where appropriate

PRESERVE WITHOUT EXCEPTION:
- Every single fact, statistic, date, name, quote, citation, and piece of evidence
- The core argument and its logical structure
- The conclusion reached by the original text

ABSOLUTE OUTPUT CONSTRAINTS:
- Return ONLY the rewritten text — no preamble, no explanation, no labels
- Zero markdown: no bold, no italics, no headers, no bullet points, no code blocks
- Plain text only, as if typed directly in a word processor`,
};

// ── REGISTER NOTES ─────────────────────────────────────────────────────────
const registerNotes: Record<string, string> = {
  research_paper: "Maintain formal academic register. No slang. Contractions only where genuinely natural in academic discourse.",
  report: "Write with clarity and directness. Concise sentences preferred. Professional tone but authentically human.",
  essay: "Allow natural student voice. Mild personality is appropriate. Do not over-formalize.",
  general: "Natural and clear. Conversational where appropriate. No forced academic register.",
};

// ── SHARED API CALL HELPER ─────────────────────────────────────────────────
// Centralises the API call so chunked and single-block calls use the same config.
// GAP 2 FIX: frequency_penalty and presence_penalty added here once — applies everywhere.
async function callHumanizerModel(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  model = "anthropic/claude-haiku-3-5"
): Promise<string | null> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        temperature: 0.95,       // High entropy for lexical unpredictability
        top_p: 0.95,             // Nucleus sampling for natural variation
        frequency_penalty: 0.6, // GAP 2: Penalises repeated token sequences
        presence_penalty: 0.4,  // GAP 2: Penalises tokens already used in output
      }),
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

// ── MAIN SERVER ────────────────────────────────────────────────────────────
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

    const token = authHeader.slice(7).trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Per-user rate limit. Fails OPEN if the check itself errors so a limiter
    // hiccup never blocks legitimate users.
    const { data: rlAllowed, error: rlError } = await supabase.rpc("check_rate_limit", {
      p_fn: "humanizer",
      p_limit: 12,
      p_window_seconds: 60,
    });
    if (rlError) {
      console.error("rate limit check failed:", rlError.message);
    } else if (rlAllowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please slow down and try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const level = intensity && intensityCores[intensity] ? intensity : "moderate";
    const dt = docType && personaMap[docType] ? docType : "general";

    // ── GAP 1: PRE-PROCESS before building the system prompt ──────────────
    const preprocessedText = preprocessText(text);

    let wordCountInstruction = "";
    if (targetWordCount && typeof targetWordCount === "number" && targetWordCount > 0) {
      wordCountInstruction = `\nTARGET LENGTH: Approximately ${targetWordCount} words. Expand or compress naturally — do not pad with filler or cut key arguments to hit this number.`;
    }

    const systemPrompt = `You are ${personaMap[dt]}. The text below is your own rough draft. You are now rewriting it as your final, polished submission.

DOCUMENT TYPE: ${dt.replace("_", " ")}
REGISTER: ${registerNotes[dt]}

CRITICAL ARCHITECTURAL CONSTRAINT:
Process this text at the sentence level, not at the macro paragraph level. Every single sentence must be examined for auditory naturalness, AI signature elimination, structural uniqueness, and conversational authenticity.

${intensityCores[level]}
${wordCountInstruction}

ABSOLUTE OUTPUT CONSTRAINTS:
- Return ONLY the rewritten text. No preamble, no explanation, no labels.
- Zero markdown formatting of any kind — no bold, no italics, no headers, no bullets.
- Plain text only, as if typed in a word processor.
- The output must read as if written entirely by a real person.`;

    const inputWordCount = preprocessedText.split(/\s+/).length;
    let finalText = "";

    // ── GAP 6: CHUNKING for long full-intensity texts ─────────────────────
    // Texts over 1500 words processed in chunks to prevent uniform
    // transformation patterns that ZeroGPT detects in single-block processing.
    if (level === "full" && inputWordCount > 1500) {
      const chunks = chunkText(preprocessedText, 400);
      const processedChunks: string[] = [];

      for (const chunk of chunks) {
        let result = await callHumanizerModel(LOVABLE_API_KEY, systemPrompt, chunk);

        // Per-chunk fallback to Gemini if Claude fails
        if (!result) {
          result = await callHumanizerModel(
            LOVABLE_API_KEY,
            systemPrompt,
            chunk,
            "google/gemini-2.0-flash"
          );
        }

        // If both fail for this chunk, keep the preprocessed original
        processedChunks.push(result ? postProcessText(result) : chunk);
      }

      finalText = processedChunks.join("\n\n");

    } else {
      // ── SINGLE-BLOCK PROCESSING for short/medium texts ─────────────────
      let result = await callHumanizerModel(
        LOVABLE_API_KEY,
        systemPrompt,
        preprocessedText
      );

      if (!result) {
        // Primary model failed — fallback to Gemini
        console.warn("Primary model failed, attempting fallback to google/gemini-2.0-flash");
        result = await callHumanizerModel(
          LOVABLE_API_KEY,
          systemPrompt,
          preprocessedText,
          "google/gemini-2.0-flash"
        );
      }

      if (!result || result.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Humanizer returned an empty response. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalText = result;
    }

    // ── GAP 3: POST-PROCESS the final assembled text ───────────────────────
    const cleanedText = postProcessText(finalText);

    if (!cleanedText || cleanedText.length === 0) {
      return new Response(
        JSON.stringify({ error: "Humanizer returned an empty response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ humanizedText: cleanedText, intensity: level }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Humanizer error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
