import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SCORER_VERSION,
  normalizeText,
  computeDeterministicScore,
  deriveRiskLevel,
  hashText,
} from "./scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── AI SIGNATURE WORD REGISTRY ─────────────────────────────────────────────
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

// ── AI SIGNATURE PHRASES ───────────────────────────────────────────────────
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
];

// ── TRANSITION WORD LIST ───────────────────────────────────────────────────
const TRANSITION_WORDS = [
  "however", "therefore", "consequently", "furthermore", "moreover",
  "additionally", "in addition", "as a result", "thus", "hence",
  "nonetheless", "nevertheless", "on the other hand", "in contrast",
  "for example", "for instance", "in particular", "specifically",
  "in conclusion", "to summarize", "in summary",
];

// ── PRE-ANALYSIS ───────────────────────────────────────────────────────────
function analyzeTextSignals(text: string) {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const wordCount = text.split(/\s+/).length;
  const lowerText = text.toLowerCase();

  const avgSentenceLength =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0;

  // Burstiness
  const variance =
    sentenceLengths.length > 1
      ? sentenceLengths.reduce(
          (acc, len) => acc + Math.pow(len - avgSentenceLength, 2),
          0
        ) / sentenceLengths.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const burstinessScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 6)));

  // Uniformity runs
  let uniformRuns = 0;
  for (let i = 0; i < sentenceLengths.length - 2; i++) {
    if (
      Math.abs(sentenceLengths[i] - sentenceLengths[i + 1]) <= 3 &&
      Math.abs(sentenceLengths[i + 1] - sentenceLengths[i + 2]) <= 3
    ) uniformRuns++;
  }
  const uniformityScore =
    sentenceLengths.length > 2
      ? Math.min(100, Math.round((uniformRuns / (sentenceLengths.length - 2)) * 100))
      : 0;

  // Coherence uniformity — measures how logically perfect each sentence-to-sentence
  // transition is. Humans leave gaps; AI fills every gap perfectly.
  // Proxy: ratio of sentences that start with a subject or connector vs. fragment openers.
  const subjectStartPattern = /^(the|a|an|this|that|these|those|it|they|he|she|we|i|you|there|here)\s/i;
  const subjectStarts = sentences.filter(s => subjectStartPattern.test(s)).length;
  const coherenceUniformityScore = sentences.length > 0
    ? Math.round((subjectStarts / sentences.length) * 100)
    : 0;

  // AI signature words
  const aiWordHits: { word: string; count: number }[] = [];
  for (const word of AI_SIGNATURE_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/-/g, "[-]?")}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) aiWordHits.push({ word, count: matches.length });
  }
  const totalAiWordHits = aiWordHits.reduce((a, b) => a + b.count, 0);
  const signatureWordDensity = wordCount > 0 ? (totalAiWordHits / wordCount) * 1000 : 0;

  // AI phrase hits
  const aiPhraseHits: { phrase: string; count: number }[] = [];
  for (const phrase of AI_SIGNATURE_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) aiPhraseHits.push({ phrase, count: matches.length });
  }

  // Transition density
  let transitionCount = 0;
  for (const tw of TRANSITION_WORDS) {
    const regex = new RegExp(`\\b${tw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches) transitionCount += matches.length;
  }
  const transitionDensity = wordCount > 0 ? (transitionCount / wordCount) * 1000 : 0;

  // Paragraph-level analysis
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 30);
  const paragraphRisks = paragraphs.map((para, idx) => {
    const paraWords = para.split(/\s+/).length;
    const paraLower = para.toLowerCase();
    const paraSentences = para
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    const paraLengths = paraSentences.map((s) => s.split(/\s+/).length);
    const paraAvg = paraLengths.length > 0
      ? paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length : 0;
    const paraVariance = paraLengths.length > 1
      ? paraLengths.reduce((acc, l) => acc + Math.pow(l - paraAvg, 2), 0) / paraLengths.length : 0;
    const paraStdDev = Math.sqrt(paraVariance);

    let paraAiWords = 0;
    for (const word of AI_SIGNATURE_WORDS) {
      const regex = new RegExp(`\\b${word.replace(/-/g, "[-]?")}\\b`, "gi");
      const m = paraLower.match(regex);
      if (m) paraAiWords += m.length;
    }
    const paraAiDensity = paraWords > 0 ? (paraAiWords / paraWords) * 1000 : 0;
    const paraBurstiness = Math.max(0, Math.min(100, Math.round(100 - paraStdDev * 8)));

    // Combined paragraph risk score
    const riskScore = Math.min(100, Math.round(
      paraBurstiness * 0.4 +
      Math.min(100, paraAiDensity * 6) * 0.4 +
      (paraSentences.length <= 2 ? 20 : 0)
    ));

    return {
      index: idx + 1,
      preview: para.substring(0, 80).trim() + (para.length > 80 ? "…" : ""),
      risk_score: riskScore,
      word_count: paraWords,
      burstiness: paraBurstiness,
      ai_word_density: parseFloat(paraAiDensity.toFixed(1)),
    };
  });

  return {
    aiWordHits,
    aiPhraseHits,
    sentenceLengths,
    burstinessScore,
    transitionDensity,
    avgSentenceLength,
    uniformityScore,
    coherenceUniformityScore,
    paragraphCount: paragraphs.length,
    wordCount,
    signatureWordDensity,
    paragraphRisks,
  };
}

// ── SIGNAL SUMMARY ─────────────────────────────────────────────────────────
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
        ? "HIGH RISK — sentence lengths are suspiciously uniform"
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

  lines.push(`\n[COHERENCE UNIFORMITY] Score: ${signals.coherenceUniformityScore}/100`);
  lines.push(
    `  Interpretation: ${
      signals.coherenceUniformityScore >= 80
        ? "HIGH — suspiciously consistent subject-first sentence structure"
        : signals.coherenceUniformityScore >= 60
        ? "MODERATE — fairly uniform sentence opening patterns"
        : "LOW — natural variation in how sentences open"
    }`
  );

  lines.push(
    `\n[TRANSITION DENSITY] ${signals.transitionDensity.toFixed(1)} per 1000 words`
  );
  lines.push(
    `  Interpretation: ${
      signals.transitionDensity >= 15
        ? "HIGH — overuse of explicit transitional phrases"
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

  // Paragraph risk summary
  if (signals.paragraphRisks.length > 0) {
    lines.push(`\n[PARAGRAPH RISK BREAKDOWN]`);
    signals.paragraphRisks.forEach((p) => {
      lines.push(
        `  Para ${p.index} (${p.word_count}w): risk=${p.risk_score}/100, burstiness=${p.burstiness}, ai_density=${p.ai_word_density}/1000`
      );
    });
  }

  lines.push(`\n=== END SIGNALS — use these to calibrate your scoring ===`);
  return lines.join("\n");
}

// ── SHARED MODEL CALL ──────────────────────────────────────────────────────
async function callModel(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  tools: object[],
  toolChoice: object,
  model = "anthropic/claude-haiku-3-5"
) {
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
          { role: "user", content: userMessage },
        ],
        // Temperature 0: the model only writes the qualitative explanation now
        // (the score is computed in code), so we want maximum stability. The
        // gateway has no reliable seed support, so we don't send one — full
        // response determinism is guaranteed by the detection_cache instead.
        temperature: 0,
        top_p: 0.9,
        tools,
        tool_choice: toolChoice,
      }),
    }
  );
  return response;
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
      p_fn: "plagiarism",
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

    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Text must be at least 50 characters for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 30000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds 30,000 character limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // One canonical string for the cache hash, the signal computation, and the
    // prompt — whitespace/line-ending/unicode variants of the same essay must
    // neither score differently nor collide on a cache key.
    const normalizedText = normalizeText(text);
    const textHash = await hashText(normalizedText);

    // Cache: identical text (same user, same scorer version) returns the
    // stored report byte-identically — no signal pass, no model call. Runs
    // AFTER the rate-limit check and input validation above, so it does not
    // weaken either.
    const { data: cached } = await supabase
      .from("detection_cache")
      .select("result")
      .eq("user_id", userData.user.id)
      .eq("text_hash", textHash)
      .eq("scorer_version", SCORER_VERSION)
      .maybeSingle();
    if (cached?.result) {
      return new Response(
        JSON.stringify(cached.result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run pre-analysis on the canonical text
    const signals = analyzeTextSignals(normalizedText);
    const signalSummary = buildSignalSummary(signals);

    // The number is decided HERE, in code — a pure function of the measured
    // signals. The model never chooses or adjusts it.
    const overallScore = computeDeterministicScore(signals);
    const riskLevel = deriveRiskLevel(overallScore);

    const systemPrompt = `You are the EXPLANATION engine of an academic AI-content detector. The overall score has ALREADY been computed deterministically from measured linguistic signals — you do not score, adjust, or second-guess it. Your job is to explain it and point at concrete evidence in the text.

THE COMPUTED RESULT (fixed, not yours to change):
- Overall score: ${overallScore}/100
- Risk band: ${riskLevel.replace("_", " ").toUpperCase()} (0–15 clean, 16–40 low risk, 41–70 moderate, 71–100 high risk)

You have been given TWO inputs:
1. The pre-computed linguistic signals that produced that score (burstiness, AI signature word density, transition density, coherence uniformity, paragraph-level risks)
2. The text itself

Write your summary, flagged passages, strengths, and indicators so they are CONSISTENT with the computed score and band above — explain what drove the number using the measured signals as ground truth. This is a heuristic signals-based estimate, not proof of misconduct; keep the summary factual about what was measured, never accusatory.

You MUST respond using the "plagiarism_report" tool.

═══════════════════════════════════════════════════════
WHAT TO LOOK FOR WHEN EXPLAINING AND FLAGGING PASSAGES:
═══════════════════════════════════════════════════════

a) PERPLEXITY — predictable LLM word choices: "delve," "tapestry," "leverage," "robust," "nuanced," "paramount," "multifaceted," "seamlessly," "foster," "facilitate," "streamline," "empower," "harness," "innovative," "transformative," "cutting-edge," "pivotal," "underscore," "synergy," "holistic"
b) BURSTINESS — unnaturally uniform sentence lengths.
c) TRANSITION DENSITY — over-use of explicit connectors.
d) STRUCTURAL PATTERNS — triadic lists, "not only X but also Y," balanced hedging.
e) AI PREAMBLE PHRASES, style inconsistency, formulaic structure, uncited factual claims, coherence uniformity.

CONFIDENCE SCORING (per flagged passage):
- 90–100: Multiple strong signals converge — high certainty
- 70–89: Clear primary signal with supporting evidence
- 50–69: Single clear signal, moderate certainty
- 30–49: Weak or ambiguous signal — flag but note uncertainty
- Below 30: Do not flag — too speculative

CONCERN TYPES:
• "ai_generated" • "ai_signature_words" • "ai_signature_phrases"
• "low_burstiness" • "high_transition_density" • "formulaic_structure"
• "style_inconsistency" • "common_phrasing" • "uncited_claim" • "coherence_uniformity"`;

    const userMessage = `${signalSummary}\n\n=== TEXT TO ANALYZE ===\n\n${normalizedText}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "plagiarism_report",
          description: "Submit an advanced plagiarism and AI-detection analysis report",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "2–3 sentence assessment citing specific signals detected",
              },
              originality_strengths: {
                type: "array",
                items: { type: "string" },
                description: "1–3 genuine originality strengths",
              },
              source_indicators: {
                type: "object",
                properties: {
                  ai_word_density: { type: "string" },
                  burstiness_risk: { type: "string" },
                  transition_density: { type: "string" },
                  coherence_uniformity: { type: "string" },
                  top_ai_words: { type: "array", items: { type: "string" } },
                  structural_patterns: { type: "array", items: { type: "string" } },
                },
                required: ["ai_word_density", "burstiness_risk", "transition_density", "coherence_uniformity", "top_ai_words", "structural_patterns"],
                additionalProperties: false,
              },
              flagged_passages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    excerpt: { type: "string", description: "Exact flagged text verbatim (15–60 words)" },
                    concern_type: {
                      type: "string",
                      enum: [
                        "ai_generated", "ai_signature_words", "ai_signature_phrases",
                        "low_burstiness", "high_transition_density", "formulaic_structure",
                        "style_inconsistency", "common_phrasing", "uncited_claim", "coherence_uniformity",
                      ],
                    },
                    reason: { type: "string", description: "Technical explanation citing exact words/patterns" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                    confidence: { type: "number", description: "Detection confidence 0–100" },
                    suggestion: { type: "string", description: "One concrete actionable fix" },
                  },
                  required: ["excerpt", "concern_type", "reason", "severity", "confidence", "suggestion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "originality_strengths", "source_indicators", "flagged_passages"],
            additionalProperties: false,
          },
        },
      },
    ];

    const toolChoice = { type: "function", function: { name: "plagiarism_report" } };

    // Primary: Claude Haiku (better at nuanced pattern detection than Gemini Flash)
    let response = await callModel(LOVABLE_API_KEY, systemPrompt, userMessage, tools, toolChoice);

    // Fallback: Gemini Flash
    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.warn("Primary model failed, falling back to google/gemini-2.0-flash");
      response = await callModel(
        LOVABLE_API_KEY, systemPrompt, userMessage, tools, toolChoice,
        "google/gemini-2.0-flash"
      );
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "We couldn't analyze this text right now. Please try again in a moment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let report;
    try {
      report = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("plagiarism: malformed tool arguments:", parseErr);
      return new Response(
        JSON.stringify({ error: "We couldn't analyze this text right now. Please try again in a moment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // The score and band come from code — overwrite anything the model may
    // have volunteered so the number is always the deterministic one.
    report.overall_score = overallScore;
    report.risk_level = riskLevel;

    // Attach raw signals for UI display
    report.raw_signals = {
      burstiness_score: signals.burstinessScore,
      uniformity_score: signals.uniformityScore,
      coherence_uniformity_score: signals.coherenceUniformityScore,
      transition_density: parseFloat(signals.transitionDensity.toFixed(1)),
      signature_word_density: parseFloat(signals.signatureWordDensity.toFixed(1)),
      word_count: signals.wordCount,
      sentence_count: signals.sentenceLengths.length,
      avg_sentence_length: parseFloat(signals.avgSentenceLength.toFixed(1)),
      paragraph_risks: signals.paragraphRisks,
    };

    // The exact deterministic AI words/phrases found, for the editor to
    // highlight every occurrence (independent of the model's quoting).
    report.ai_words_found = signals.aiWordHits.map((h: { word: string }) => h.word);
    report.ai_phrases_found = signals.aiPhraseHits.map((h: { phrase: string }) => h.phrase);

    // Cache the FULL assembled report (the exact payload the client renders
    // and writes plagiarism_score from), then prune this user's stale rows.
    // Both are best-effort: a cache hiccup must never fail the scan.
    try {
      await supabase.from("detection_cache").upsert(
        {
          user_id: userData.user.id,
          text_hash: textHash,
          scorer_version: SCORER_VERSION,
          result: report,
        },
        { onConflict: "user_id,text_hash", ignoreDuplicates: true }
      );
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("detection_cache")
        .delete()
        .eq("user_id", userData.user.id)
        .lt("created_at", cutoff);
    } catch (cacheErr) {
      console.error("detection_cache write failed:", cacheErr);
    }

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
