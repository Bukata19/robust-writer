import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export type DecoderDocType = 'essay' | 'research_paper' | 'report' | 'general';
export type AcademicLevel = 'high_school' | 'undergraduate' | 'postgraduate' | null;
export type DecoderStep = 'input' | 'confirm_type' | 'outline_ready' | 'writing';

export interface OutlineSection {
  id: string;
  heading: string;
  guidanceTip: string;
  wordCountSuggestion: number;
  marks?: number | null;           // ENHANCEMENT 6: marks for this section, if specified
}

// ENHANCEMENT 1: structured result of analysing the question's command words
export interface QuestionAnalysis {
  instructionVerbs: string[];      // e.g. ["evaluate", "compare"]
  verbGuidance: string;            // what those verbs demand of the writer
  totalMarks: number | null;       // total marks if the question stated them
}

const DECODER_STORAGE_KEY = (docId: string) => `rb_decoder_${docId}`;

interface PersistedDecoderState {
  question: string;
  detectedDocType: DecoderDocType | null;
  detectionReason: string;
  confirmedDocType: DecoderDocType | null;
  academicLevel: AcademicLevel;
  outline: OutlineSection[];
  sessionContext: string;
  step: DecoderStep;
  questionAnalysis: QuestionAnalysis | null;   // ENHANCEMENT 1: persisted
}

interface UseAssignmentDecoderOptions {
  editor: Editor | null;
  documentId?: string;
  onConfirmReplace?: () => Promise<boolean> | boolean;
}

async function callChat(messages: { role: string; content: string }[]): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok || !res.body) throw new Error('Request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? '';
        if (delta) out += delta;
      } catch { /* ignore */ }
    }
  }
  return out;
}

function extractJson(raw: string): any | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── ENHANCEMENT 4: HUMAN-LIKE GENERATION ───────────────────────────────────
// Mirrors the humanizer's prompt architecture so generated sections come out
// already varied and natural, rather than uniform AI prose that needs a second
// humanizing pass.
const personaByLevel: Record<string, string> = {
  high_school: 'a capable high-school student who writes clearly and with genuine engagement, not robotically',
  undergraduate: 'a third-year undergraduate who writes with conviction and a natural personal voice',
  postgraduate: 'a postgraduate researcher who writes with analytical authority but retains a human cadence',
  university: 'a university student who writes with a clear, natural, engaged voice',
};

const HUMAN_STYLE_RULES = `
WRITE LIKE A REAL PERSON, NOT AN AI:
- Vary sentence length dramatically. Mix short punchy sentences (4-8 words) with longer flowing ones (25-35 words). Never write three similar-length sentences in a row.
- Do NOT use these AI-signature words: delve, leverage, robust, multifaceted, nuanced, furthermore, moreover, paramount, crucial, seamless, foster, comprehensive, pivotal, underscore.
- Do NOT use formulaic openers like "In conclusion," "It is important to note that," "In today's world."
- Avoid lists of exactly three. Use two or four points instead.
- Start some sentences with conjunctions (But, Yet, So, And) where natural.
- Use the occasional em-dash aside — like this — and a rhetorical question where it fits.
- Write with genuine conviction. Let one or two ideas feel slightly exploratory rather than perfectly resolved.`;

// ── ENHANCEMENT 6: marks → word budget ─────────────────────────────────────
// If the question carries mark allocations, scale word counts proportionally so
// effort matches what each part is worth. ~40 words per mark is a sensible
// academic baseline, clamped to keep sections reasonable.
function applyMarksToWordCounts(sections: OutlineSection[]): OutlineSection[] {
  const anyMarks = sections.some((s) => typeof s.marks === 'number' && (s.marks ?? 0) > 0);
  if (!anyMarks) return sections;
  return sections.map((s) => {
    if (typeof s.marks === 'number' && s.marks > 0) {
      const budget = Math.round(s.marks * 40);
      return { ...s, wordCountSuggestion: Math.max(80, Math.min(1200, budget)) };
    }
    return s;
  });
}

export function useAssignmentDecoder({ editor, documentId, onConfirmReplace }: UseAssignmentDecoderOptions) {

  const loadPersisted = (): Partial<PersistedDecoderState> => {
    if (!documentId) return {};
    try {
      const raw = localStorage.getItem(DECODER_STORAGE_KEY(documentId));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const persisted = loadPersisted();

  const [question, setQuestion] = useState(persisted.question ?? '');
  const [detectedDocType, setDetectedDocType] = useState<DecoderDocType | null>(persisted.detectedDocType ?? null);
  const [detectionReason, setDetectionReason] = useState<string>(persisted.detectionReason ?? '');
  const [confirmedDocType, setConfirmedDocType] = useState<DecoderDocType | null>(persisted.confirmedDocType ?? null);
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>(persisted.academicLevel ?? null);
  const [outline, setOutline] = useState<OutlineSection[]>(persisted.outline ?? []);
  const [sessionContext, setSessionContext] = useState<string>(persisted.sessionContext ?? '');
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis | null>(persisted.questionAnalysis ?? null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState<{ heading: string; content: string } | null>(null);
  const [step, setStep] = useState<DecoderStep>(persisted.step ?? 'input');
  const [analysing, setAnalysing] = useState(false);

  // Persist whenever meaningful state changes
  useEffect(() => {
    if (!documentId || step === 'input') {
      if (documentId && step === 'input' && !question.trim()) {
        localStorage.removeItem(DECODER_STORAGE_KEY(documentId));
      }
      return;
    }
    try {
      const toSave: PersistedDecoderState = {
        question, detectedDocType, detectionReason, confirmedDocType,
        academicLevel, outline, sessionContext, step, questionAnalysis,
      };
      localStorage.setItem(DECODER_STORAGE_KEY(documentId), JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [documentId, question, detectedDocType, detectionReason, confirmedDocType, academicLevel, outline, sessionContext, step, questionAnalysis]);

  const reset = useCallback(() => {
    if (documentId) {
      try { localStorage.removeItem(DECODER_STORAGE_KEY(documentId)); } catch { /* ignore */ }
    }
    setQuestion('');
    setDetectedDocType(null);
    setDetectionReason('');
    setConfirmedDocType(null);
    setAcademicLevel(null);
    setOutline([]);
    setSessionContext('');
    setQuestionAnalysis(null);
    setActiveSection(null);
    setGeneratingSection(null);
    setSectionDraft(null);
    setStep('input');
  }, [documentId]);

  // ── ANALYSE QUESTION (now with ENHANCEMENT 1 + 6 baked in) ───────────────
  const analyseQuestion = useCallback(async () => {
    if (!question.trim()) return;
    setAnalysing(true);
    try {
      const system = `You are an academic assignment analyser. Read the student's assignment question carefully and produce a structured breakdown.

STEP 1 — INSTRUCTION VERBS: Identify the command word(s) that define HOW the student must answer (e.g. discuss, analyse, evaluate, compare, contrast, critically assess, justify, examine, describe, explain). These dictate the entire structure. For example "evaluate" demands weighing strengths against weaknesses and reaching a judgement; "compare" demands systematic side-by-side treatment; "critically assess" demands taking and defending a position.

STEP 2 — MARKS: If the question states mark allocations per part (e.g. "(5 marks)", "[20]"), capture them. If none are stated, use null.

STEP 3 — DOC TYPE: Pick the most appropriate from "essay", "research_paper", "report", "general".

STEP 4 — OUTLINE: Build 4-8 sections SHAPED BY the instruction verbs. The structure must reflect what the verbs demand — not a generic intro/body/conclusion unless that genuinely fits. Each heading must be specific to THIS assignment. Attach the part's marks to the relevant section when known.

Respond with ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{
  "detectedDocType": "essay" | "research_paper" | "report" | "general",
  "reason": "one short sentence explaining the doc type choice",
  "instructionVerbs": ["string"],
  "verbGuidance": "one or two sentences on what these command words require the writer to actually DO",
  "totalMarks": number | null,
  "suggestedTotalWords": number,
  "outlineSections": [
    { "heading": "string", "guidanceTip": "short actionable guidance referencing the instruction verb where relevant", "wordCountSuggestion": number, "marks": number | null }
  ]
}`;
      const raw = await callChat([
        { role: 'system', content: system },
        { role: 'user', content: question },
      ]);
      const parsed = extractJson(raw);
      if (!parsed || !Array.isArray(parsed.outlineSections)) {
        toast.error('Could not analyse question — try rephrasing it');
        return;
      }

      const dt = (parsed.detectedDocType as DecoderDocType) ?? 'essay';
      setDetectedDocType(dt);
      setConfirmedDocType(dt);
      setDetectionReason(typeof parsed.reason === 'string' ? parsed.reason : '');

      // ENHANCEMENT 1: store the instruction-verb analysis
      setQuestionAnalysis({
        instructionVerbs: Array.isArray(parsed.instructionVerbs)
          ? parsed.instructionVerbs.map((v: any) => String(v)) : [],
        verbGuidance: typeof parsed.verbGuidance === 'string' ? parsed.verbGuidance : '',
        totalMarks: typeof parsed.totalMarks === 'number' ? parsed.totalMarks : null,
      });

      let sections: OutlineSection[] = parsed.outlineSections.map((s: any, i: number) => ({
        id: `sec-${i}-${Date.now()}`,
        heading: String(s.heading ?? `Section ${i + 1}`),
        guidanceTip: String(s.guidanceTip ?? ''),
        wordCountSuggestion: Number(s.wordCountSuggestion) || 200,
        marks: typeof s.marks === 'number' ? s.marks : null,
      }));

      // ENHANCEMENT 6: rescale word counts by marks where provided
      sections = applyMarksToWordCounts(sections);

      setOutline(sections);
      setStep('confirm_type');
    } catch {
      toast.error('Could not analyse question — try rephrasing it');
    } finally {
      setAnalysing(false);
    }
  }, [question]);

  const confirmAndBuildOutline = useCallback(
    async (docType: DecoderDocType, level: AcademicLevel) => {
      if (!editor) return;

      const hasContent = editor.getText().trim().length > 0;
      if (hasContent && onConfirmReplace) {
        const ok = await onConfirmReplace();
        if (!ok) return;
      }

      setConfirmedDocType(docType);
      setAcademicLevel(level);
      setSessionContext(question);

      const titleNode = {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Assignment' }],
      };
      const nodes: any[] = [titleNode];
      for (const sec of outline) {
        nodes.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: sec.heading }],
        });
        nodes.push({ type: 'paragraph' });
      }
      editor.commands.setContent({ type: 'doc', content: nodes });
      setStep('outline_ready');
    },
    [editor, outline, question, onConfirmReplace],
  );

  // ── ENHANCEMENT 3: read what's already written in OTHER sections ──────────
  // Builds a compact summary of existing section content so the model doesn't
  // repeat intros, reuse the same examples, or contradict earlier arguments.
  const buildCrossSectionContext = useCallback(
    (currentHeading: string): string => {
      if (!editor) return '';
      const doc = editor.state.doc;
      const sections: { heading: string; text: string }[] = [];
      let currentH: string | null = null;
      let buffer: string[] = [];

      const flush = () => {
        if (currentH) {
          const text = buffer.join(' ').trim();
          if (text) sections.push({ heading: currentH, text });
        }
        buffer = [];
      };

      doc.descendants((node) => {
        if (node.type.name === 'heading' && (node.attrs as any)?.level === 2) {
          flush();
          currentH = node.textContent.trim();
        } else if (node.type.name === 'paragraph') {
          const t = node.textContent.trim();
          if (t) buffer.push(t);
        }
        return true;
      });
      flush();

      const others = sections.filter(
        (s) => s.heading !== currentHeading.trim() && s.text.length > 0,
      );
      if (others.length === 0) return '';

      // Cap each summary so the prompt stays lean
      const summary = others
        .map((s) => {
          const snippet = s.text.length > 280 ? s.text.slice(0, 280) + '…' : s.text;
          return `• "${s.heading}": ${snippet}`;
        })
        .join('\n');

      return summary;
    },
    [editor],
  );

  // ── GENERATE SECTION (ENHANCEMENT 1 + 3 + 4 combined) ────────────────────
  const generateSection = useCallback(
    async (heading: string) => {
      const section = outline.find((s) => s.heading === heading);
      if (!section) return;
      setGeneratingSection(heading);
      try {
        const persona = personaByLevel[academicLevel ?? 'university'] ?? personaByLevel.university;

        // ENHANCEMENT 1: instruction-verb directives
        const verbBlock = questionAnalysis && questionAnalysis.instructionVerbs.length > 0
          ? `\nINSTRUCTION VERBS for this assignment: ${questionAnalysis.instructionVerbs.join(', ')}.
WHAT THEY DEMAND: ${questionAnalysis.verbGuidance}
This section must actively DO what these verbs require — not merely describe. If the verb is "evaluate", weigh and judge. If "compare", set things side by side. If "critically assess", take and defend a position with evidence.`
          : '';

        // ENHANCEMENT 3: cross-section awareness
        const crossContext = buildCrossSectionContext(heading);
        const crossBlock = crossContext
          ? `\nALREADY WRITTEN IN OTHER SECTIONS (do NOT repeat these points, examples, or restate the introduction — build on them and stay consistent with them):\n${crossContext}`
          : '';

        const system = `You are ${persona}. You are writing the "${heading}" section of a ${confirmedDocType ?? 'essay'}.

THE ASSIGNMENT QUESTION: ${sessionContext}

SECTION GUIDANCE: ${section.guidanceTip}
TARGET LENGTH: approximately ${section.wordCountSuggestion} words.${verbBlock}${crossBlock}

${HUMAN_STYLE_RULES}

OUTPUT RULES:
- Write ONLY the body of the "${heading}" section as paragraphs. Do NOT include the heading itself.
- No markdown, no bullet symbols, no labels — just clean paragraphs of prose.
- Preserve full academic substance and accuracy while sounding genuinely human.`;

        const content = await callChat([
          { role: 'system', content: system },
          { role: 'user', content: `Write the "${heading}" section now.` },
        ]);
        if (!content.trim()) throw new Error('empty');
        setSectionDraft({ heading, content: content.trim() });
      } catch {
        toast.error('Failed to generate section — try again');
      } finally {
        setGeneratingSection(null);
      }
    },
    [outline, confirmedDocType, academicLevel, sessionContext, questionAnalysis, buildCrossSectionContext],
  );

  const acceptSection = useCallback(() => {
    if (!editor || !sectionDraft) return;
    const { heading, content } = sectionDraft;
    const doc = editor.state.doc;
    let insertPos: number | null = null;
    doc.descendants((node, pos) => {
      if (insertPos !== null) return false;
      if (node.type.name === 'heading' && node.textContent.trim() === heading.trim()) {
        insertPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    if (insertPos === null) {
      toast.error('Could not find that section heading');
      return;
    }
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }));

    editor.chain().focus().insertContentAt(insertPos, paragraphs).run();
    setSectionDraft(null);
  }, [editor, sectionDraft]);

  const rewriteSection = useCallback(
    (heading: string) => {
      setSectionDraft(null);
      generateSection(heading);
    },
    [generateSection],
  );

  // Track active section based on cursor position.
  // Throttled via requestAnimationFrame so rapid keystrokes coalesce into a
  // single document traversal per animation frame.
  useEffect(() => {
    if (!editor || step !== 'outline_ready') return;
    let rafId: number | null = null;
    const update = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          const { $anchor } = editor.state.selection;
          let current: string | null = null;
          for (let d = $anchor.depth; d >= 0; d--) {
            const before = $anchor.before(d);
            const doc = editor.state.doc;
            let lastHeading: string | null = null;
            doc.descendants((node, pos) => {
              if (pos > before) return false;
              if (node.type.name === 'heading' && (node.attrs as any)?.level === 2) {
                lastHeading = node.textContent;
              }
              return true;
            });
            if (lastHeading) { current = lastHeading; break; }
          }
          setActiveSection(current);
        } catch { /* ignore */ }
      });
    };
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    update();
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [editor, step]);

  return {
    question,
    setQuestion,
    detectedDocType,
    detectionReason,
    confirmedDocType,
    setConfirmedDocType,
    academicLevel,
    setAcademicLevel,
    outline,
    sessionContext,
    questionAnalysis,
    activeSection,
    generatingSection,
    sectionDraft,
    step,
    setStep,
    analysing,
    analyseQuestion,
    confirmAndBuildOutline,
    generateSection,
    acceptSection,
    rewriteSection,
    reset,
  };
}
