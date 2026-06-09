import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── AI SIGNATURE WORD REGISTRY (mirrored from Humanizer) ──────────────────
// These are statistically over-represented in LLM output and are primary
// detection signals for ZeroGPT, GPTZero, Originality.ai, and Copyleaks.
const AI_SIGNATURE_WORDS = [
  "delve", "tapestry", "leverage", "leveraging", "leveraged",
  "navigating", "crucial", "paramount", "multifaceted", "robust",
  "nuanced", "nuance", "furthermore", "moreover", "myriad",
  "comprehensive", "underscore", "underscores", "underscored",
  "pivotal", "seamlessly", "intricate", "holistic", "synergy",
  "synergies", "synergistic", "foster", "fosters", "fostered",
  "fostering", "facilitate", "facilitates", "facilitated",
  "facilitating", "streamline", "streamlines", "streamlined",
  "optimize", "optimizes", "optimized", "optimizing",
  "innovative", "cutting-edge", "state-of-the-art", "groundbreaking",
  "transformative", "revolutionize", "revolutionizes", "empower",
  "empowers", "empowered", "empowering", "harness", "harnesses",
  "harnessing", "harnessed", "proactive", "proactively",
];

// ── AI SIGNATURE PHRASES (multi-word patterns) ────────────────────────────
const AI_SIGNATURE_PHRASES = [
  "it is worth noting that",
  "it should be mentioned that",
  "it is important to note that",
  "it is essential to note that",
  "it is crucial to understand",
  "in conclusion,",
  "to summarize,",
  "in summary,",
  "to sum up,",
  "in today's rapidly evolving",
  "in today's fast-paced",
  "in the ever-changing",
  "in the modern era",
  "not only ... but also",
  "on the other hand,",
  "it is undeniable that",
  "there is no denying that",
  "it goes without saying that",
  "needless to say,",
  "last but not least,",
  "in light of the above",
  "in light of the fact",
  "due to the fact that",
  "as previously mentioned",
  "as mentioned above",
  "as stated above",
  "plays a crucial role",
  "plays a pivotal role",
  "plays a key role",
  "is of paramount importance",
  "is crucial to",
  "is essential to",
];

// ── STRUCTURAL RED-FLAG PATTERNS (from Humanizer's detection knowledge) ───
const STRUCTURAL_RED_FLAGS = {
  triadicStructure: /\b(\w[\w\s,]+),\s*(\w[\w\s,]+),\s*and\s+(\w[\w\s]+)\b/g,
  balancedConstruction: /\bwhile\b.{10,80}\b(?:also|equally|similarly)\b/gi,
  notOnlyButAlso: /\bnot only\b.{5,60}\bbut also\b/gi,
  threeClauseChain: /\b\w[\w\s]+,\s+\w[\w\s]+,\s+and\s+\w[\w\s]+\./g,
  thisNounRestatement: /\bThis\s+(?:approach|method|technique|process|strategy|framework|concept|idea|analysis|study|research|finding|result|conclusion)\b/gi,
  uniformSentenceEndings: /\.\s+[A-Z]/g,
};

// ── PRE-ANALYSIS: Extract measurable signals from raw text ────────────────
function analyzeTextSignals(text: string): {
  aiWordHits: { word: string; count: number }[];
  aiPhraseHits: { phrase: string; count: number }[];
  sentenceLengths: number[];
  burstinessScore: number;
  transitionDensity: number;
  avgSentenceLength: number;
  uniformityScore: number;
  paragraphCount: number;
  wordCount: number;
  signatureWordDensity: number;
} {
  // Sentence segmentation
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const avgSentenceLength =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0;

  // Burstiness: variance in sentence length (high = more human-like)
  const variance =
    sentenceLengths.length > 1
      ? sentenceLengths.reduce(
          (acc, len) => acc + Math.pow(len - avgSentenceLength, 2),
          0
        ) / sentenceLengths.length
      : 0;
  const stdDev = Math.sqrt(variance);
  // Low stdDev (< 5) is a strong AI signal; normalize to 0–100 risk score
  const burstinessScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 6)));

  // Uniformity: runs of sentences with similar lengths (within 3 words of each other)
  let uniformRuns = 0;
  for (let i = 0; i < sentenceLengths.length - 2; i++) {
    if (
      Math.abs(sentenceLengths[i] - sentenceLengths[i + 1]) <= 3 &&
      Math.abs(sentenceLengths[i + 1] - sentenceLengths[i + 2]) <= 3
    ) {
      uniformRuns++;
    }
  }
  const uniformityScore =
    sentenceLengths.length > 2
      ? Math.min(100, Math.round((uniformRuns / (sentenceLengths.length - 2)) * 100))
      : 0;

  // AI signature word detection
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  const aiWordHits: { word: string; count: number }[] = [];
  for (const word of AI_SIGNATURE_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/-/g, "[-]?")}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      aiWordHits.push({ word, count: matches.length });
    }
  }
  const totalAiWordHits = aiWordHits.reduce((a, b) => a + b.count, 0);
  const signatureWordDensity = wordCount > 0 ? (totalAiWordHits / wordCount) * 1000 : 0; // per 1000 words

  // AI phrase detection
  const aiPhraseHits: { phrase: string; count: number }[] = [];
  for (const phrase of AI_SIGNATURE_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      aiPhraseHits.push({ phrase, count: matches.length });
    }
  }

  // Transition density: count explicit transitional phrases per 1000 words
  const transitionWords = [
    "however", "therefore", "consequently", "furthermore", "moreover",
    "additionally", "in addition", "as a result", "thus", "hence",
    "nonetheless", "nevertheless", "on the other hand", "in contrast",
    "for example", "for instance", "in particular", "specifically",
    "in conclusion", "to summarize", "in summary",
  ];
  let transitionCount = 0;
  for (const tw of transitionWords) {
    const regex = new RegExp(`\\b${tw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches) transitionCount += matches.length;
  }
  const transitionDensity = wordCount > 0 ? (transitionCount / wordCount) * 1000 : 0;

  const paragraphCount = text.split(/\n\n+/).filter((p) => p.trim().length > 20).length;

  return {
    aiWordHits,
    aiPhraseHits,
    sentenceLengths,
    burstinessScore,
    transitionDensity,
    avgSentenceLength,
    uniformityScore,
    paragraphCount,
    wordCount,
    signatureWordDensity,
  };
}

// ── BUILD SIGNAL SUMMARY for the AI prompt ────────────────────────────────
function buildSignalSummary(signals: ReturnType<typeof analyzeTextSignals>): string {
  const lines: string[] = [];

  lines.push(`=== PRE-COMPUTED LINGUISTIC SIGNALS ===`);
  lines.push(`Word count: ${signals.wordCount}`);
  lines.push(`Sentence count: ${signals.sentenceLengths.length}`);
  lines.push(`Avg sentence length: ${signals.avgSentenceLength.toFixed(1)} words`);
  lines.push(
    `Sentence length range: ${Math.min(...(signals.sentenceLengths.length > 0 ? signals.sentenceLengths : [0]))}–${Math.max(...(signals.sentenceLengths.length > 0 ? signals.sentenceLengths : [0]))} words`
  );

  lines.push(`\n[BURSTINESS] Score: ${signals.burstinessScore}/100 risk`);
  lines.push(
    `  Interpretation: ${
      signals.burstinessScore >= 70
        ? "HIGH RISK — sentence lengths are suspiciously uniform (AI pattern)"
        : signals.burstinessScore >= 45
        ? "MODERATE — some length uniformity detected"
        : "LOW RISK — natural variation in sentence length"
    }`
  );

  lines.push(`\n[UNIFORMITY RUNS] Score: ${signals.uniformityScore}/100`);
  lines.push(
    `  Interpretation: ${
      signals.uniformityScore >= 60
        ? "HIGH — multiple runs of 3+ consecutive same-length sentences"
        : signals.uniformityScore >= 30
        ? "MODERATE — some consecutive same-length sentences"
        : "LOW — sentence lengths vary naturally"
    }`
  );

  lines.push(
    `\n[TRANSITION DENSITY] ${signals.transitionDensity.toFixed(1)} explicit transitions per 1000 words`
  );
  lines.push(
    `  Interpretation: ${
      signals.transitionDensity >= 15
        ? "HIGH — overuse of explicit transitional phrases (strong AI marker)"
        : signals.transitionDensity >= 8
        ? "MODERATE — somewhat elevated transition frequency"
        : "NORMAL — natural transition usage"
    }`
  );

  lines.push(
    `\n[AI SIGNATURE WORDS] Density: ${signals.signatureWordDensity.toFixed(1)} per 1000 words`
  );
  if (signals.aiWordHits.length > 0) {
    const topHits = signals.aiWordHits
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((h) => `"${h.word}" ×${h.count}`)
      .join(", ");
    lines.push(`  Detected: ${topHits}`);
    lines.push(
      `  Interpretation: ${
        signals.signatureWordDensity >= 8
          ? "HIGH RISK — statistically over-represented LLM vocabulary"
          : signals.signatureWordDensity >= 4
          ? "MODERATE — some AI-preferred word choices detected"
          : "LOW — minor presence of AI vocabulary"
      }`
    );
  } else {
    lines.push(`  None detected.`);
  }

  if (signals.aiPhraseHits.length > 0) {
    lines.push(`\n[AI SIGNATURE PHRASES] Detected:`);
    signals.aiPhraseHits
      .slice(0, 6)
      .forEach((h) => lines.push(`  • "${h.phrase}" ×${h.count}`));
  }

  lines.push(`\n=== END SIGNALS — use these to calibrate your scoring ===`);

  return lines.join("\n");
}

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

    // ── RUN PRE-ANALYSIS ──────────────────────────────────────────────────
    const signals = analyzeTextSignals(text);
    const signalSummary = buildSignalSummary(signals);

    // ── SYSTEM PROMPT ─────────────────────────────────────────────────────
    const systemPrompt = `You are an advanced academic integrity and AI-content detection engine. Your job is to give the most accurate, calibrated originality analysis possible — the same quality used by professional tools like Copyleaks, GPTZero, and Originality.ai.

You have been given TWO inputs:
1. Pre-computed linguistic signals (burstiness, AI signature word density, transition density, uniformity runs)
2. The raw text to analyze

Use the pre-computed signals as ground-truth data to anchor your scoring. Do NOT ignore them. Your subjective reading should complement — not contradict — the measured signals.

You MUST respond using the "plagiarism_report" tool.

═══════════════════════════════════════════════════════
DETECTION FRAMEWORK — ANALYZE ACROSS ALL SEVEN LAYERS:
═══════════════════════════════════════════════════════

1. AI-GENERATION SIGNALS (weighted 35% of score)
   Primary detectors used by GPTZero / ZeroGPT / Originality.ai:
   
   a) PERPLEXITY — Are word choices predictable? LLMs pick the most statistically probable next token.
      Signals: "delve," "tapestry," "leverage," "robust," "nuanced," "paramount," "multifaceted,"
      "seamlessly," "foster," "facilitate," "streamline," "empower," "harness," "innovative,"
      "transformative," "cutting-edge," "pivotal," "underscore," "synergy," "holistic"
   
   b) BURSTINESS — LLMs produce unnaturally uniform sentence lengths. Humans write with dramatic
      variation — 4-word punchy fragments next to 40-word flowing sentences. If sentence length
      variance is low (all sentences 12–20 words), this is a primary AI signal.
   
   c) TRANSITION DENSITY — LLMs over-use explicit connectors: "Furthermore," "Moreover,"
      "Additionally," "In conclusion," "It is worth noting that," "It is important to note that,"
      "Needless to say," "Last but not least." Real writers use implicit connections.
   
   d) STRUCTURAL PATTERNS — LLMs default to:
      • Exactly 3 examples or reasons in every list
      • "Not only X, but also Y" constructions
      • "While X is true, Y is also important" balanced hedging
      • Paragraphs that restate their opening claim as their closing sentence
      • Sentences starting "This [noun] [verb]" restating the previous sentence's subject
   
   e) AI PREAMBLE PHRASES: "It is worth noting that," "It should be mentioned that,"
      "In today's rapidly evolving," "In the ever-changing landscape," "plays a crucial/pivotal role"

2. WRITING STYLE CONSISTENCY (weighted 20%)
   Sudden shifts in vocabulary sophistication, sentence complexity, or formality level within
   the same document often indicate copied sections or AI-generated inserts.

3. VOCABULARY NATURALNESS (weighted 15%)
   Overly uniform sophistication (every sentence equally complex), or use of vocabulary that
   is grammatically correct but slightly "off" for the stated context, are LLM signals.

4. SPECIFICITY & PERSONAL VOICE (weighted 10%)
   Original writing contains specific examples, personal perspective, and unique observations.
   Generic, surface-level, universally-applicable statements are AI red flags.

5. FORMULAIC STRUCTURE (weighted 10%)
   Rigid adherence to a 5-paragraph essay structure, mechanical transitions between sections,
   and textbook-perfect organization all suggest templated or AI-generated content.

6. UNCITED FACTUAL CLAIMS (weighted 5%)
   Specific statistics, dates, percentages, or authoritative claims without citation in
   academic writing suggest unattributed borrowing.

7. COHERENCE UNIFORMITY (weighted 5%)
   Real writing has occasional slight tangents, self-corrections, or imperfect elaborations.
   Machine-perfect coherence — every sentence advancing the argument optimally — is an AI signal.

═══════════════════════════════
SCORING GUIDELINES (calibrated):
═══════════════════════════════
Use the pre-computed signals to anchor these ranges:

0–15   CLEAN     — Strong originality: consistent personal voice, high burstiness, varied
                   vocabulary, specific examples, minimal AI signature words/phrases.

16–40  LOW RISK  — Mostly original. Minor concerns: a few common phrases, slightly formulaic
                   sections, or mild AI vocabulary presence. Normal for academic writing.

41–70  MODERATE  — Multiple AI/plagiarism signals: noticeable style inconsistencies, elevated
                   AI word density (4+/1000 words), low burstiness, heavy transitional phrases.

71–100 HIGH RISK — Strong AI-generation or copying indicators: low sentence-length variance,
                   multiple AI signature phrases, 8+ AI words per 1000, uniform paragraph
                   structure, no personal voice or specific examples.

CALIBRATION RULES:
- If signatureWordDensity >= 8 AND burstinessScore >= 70: overall_score should be >= 65
- If signatureWordDensity >= 4 AND transitionDensity >= 12: overall_score should be >= 45
- If burstinessScore <= 25 AND signatureWordDensity <= 2: overall_score should be <= 25
- Academic writing naturally contains some common phrases — penalize PATTERNS, not isolated terms

═══════════════════════════════════
CONCERN TYPES — choose the most precise:
═══════════════════════════════════
• "ai_generated"           — Strong LLM output signals (perplexity, burstiness, AI vocab)
• "ai_signature_words"     — Specific over-represented LLM vocabulary cluster detected
• "ai_signature_phrases"   — Canned AI opener/transition phrases detected
• "low_burstiness"         — Sentence lengths are suspiciously uniform (AI structural pattern)
• "high_transition_density"— Over-use of explicit transitional connectors
• "formulaic_structure"    — Rigid mechanical structure, triadic lists, balanced hedging
• "style_inconsistency"    — Vocabulary or voice shift suggesting copied/pasted section
• "common_phrasing"        — Generic expressions natural to the topic but worth noting
• "uncited_claim"          — Specific factual claim without attribution in academic context
• "coherence_uniformity"   — Machine-perfect paragraph logic with no natural human tangents

For each flagged passage:
- Provide the EXACT excerpt from the text (15–60 words, verbatim)
- Classify with the most precise concern_type
- Explain the specific signal clearly — be technical where helpful
- Rate severity accurately (low/medium/high)
- Give ONE actionable fix suggestion

Also identify 1–3 originality STRENGTHS (even in high-risk texts, find something genuine).`;

    // ── USER MESSAGE: signals + text ─────────────────────────────────────
    const userMessage = `${signalSummary}\n\n=== TEXT TO ANALYZE ===\n\n${text}`;

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
            { role: "user", content: userMessage },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "plagiarism_report",
                description: "Submit an advanced plagiarism and AI-detection analysis report",
                parameters: {
                  type: "object",
                  properties: {
                    overall_score: {
                      type: "number",
                      description: "Overall plagiarism/AI risk score from 0–100, calibrated against pre-computed signals",
                    },
                    summary: {
                      type: "string",
                      description: "2–3 sentence assessment citing specific signals detected (e.g., burstiness, AI vocabulary density, structural patterns)",
                    },
                    originality_strengths: {
                      type: "array",
                      description: "1–3 genuine originality strengths observed in the writing",
                      items: { type: "string" },
                    },
                    source_indicators: {
                      type: "object",
                      description: "Summary of the key detection signals found",
                      properties: {
                        ai_word_density: {
                          type: "string",
                          description: "e.g. '6.2 per 1000 words — HIGH' or '1.4 per 1000 words — LOW'",
                        },
                        burstiness_risk: {
                          type: "string",
                          description: "e.g. 'HIGH — sentence lengths uniformly 14–18 words' or 'LOW — natural variation'",
                        },
                        transition_density: {
                          type: "string",
                          description: "e.g. 'ELEVATED — 14.3 transitions/1000 words' or 'NORMAL'",
                        },
                        top_ai_words: {
                          type: "array",
                          items: { type: "string" },
                          description: "Top AI signature words found (up to 5)",
                        },
                        structural_patterns: {
                          type: "array",
                          items: { type: "string" },
                          description: "Structural AI patterns detected (e.g. 'triadic lists', 'balanced hedging', 'this-noun restatement')",
                        },
                      },
                      required: ["ai_word_density", "burstiness_risk", "transition_density", "top_ai_words", "structural_patterns"],
                      additionalProperties: false,
                    },
                    flagged_passages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          excerpt: {
                            type: "string",
                            description: "The exact flagged text excerpt verbatim from the text (15–60 words)",
                          },
                          concern_type: {
                            type: "string",
                            enum: [
                              "ai_generated",
                              "ai_signature_words",
                              "ai_signature_phrases",
                              "low_burstiness",
                              "high_transition_density",
                              "formulaic_structure",
                              "style_inconsistency",
                              "common_phrasing",
                              "uncited_claim",
                              "coherence_uniformity",
                            ],
                          },
                          reason: {
                            type: "string",
                            description: "Technical explanation of the specific signal — cite the exact words/patterns detected",
                          },
                          severity: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                          },
                          suggestion: {
                            type: "string",
                            description: "One concrete, actionable fix for this specific passage",
                          },
                        },
                        required: ["excerpt", "concern_type", "reason", "severity", "suggestion"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["overall_score", "summary", "originality_strengths", "source_indicators", "flagged_passages"],
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

    // ── ATTACH RAW SIGNAL DATA for UI display ──────────────────────────
    report.raw_signals = {
      burstiness_score: signals.burstinessScore,
      uniformity_score: signals.uniformityScore,
      transition_density: parseFloat(signals.transitionDensity.toFixed(1)),
      signature_word_density: parseFloat(signals.signatureWordDensity.toFixed(1)),
      word_count: signals.wordCount,
      sentence_count: signals.sentenceLengths.length,
      avg_sentence_length: parseFloat(signals.avgSentenceLength.toFixed(1)),
    };

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
