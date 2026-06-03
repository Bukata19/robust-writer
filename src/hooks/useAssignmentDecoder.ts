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

export function useAssignmentDecoder({ editor, documentId, onConfirmReplace }: UseAssignmentDecoderOptions) {

  // Load persisted state for this document if it exists
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState<{ heading: string; content: string } | null>(null);
  const [step, setStep] = useState<DecoderStep>(persisted.step ?? 'input');
  const [analysing, setAnalysing] = useState(false);

// Persist decoder state to localStorage whenever meaningful state changes
useEffect(() => {
  if (!documentId || step === 'input') {
    // Don't persist empty/reset state — clear any old data
    if (documentId && step === 'input' && !question.trim()) {
      localStorage.removeItem(DECODER_STORAGE_KEY(documentId));
    }
    return;
  }
  try {
    const toSave: PersistedDecoderState = {
      question,
      detectedDocType,
      detectionReason,
      confirmedDocType,
      academicLevel,
      outline,
      sessionContext,
      step,
    };
    localStorage.setItem(DECODER_STORAGE_KEY(documentId), JSON.stringify(toSave));
  } catch { /* ignore storage errors */ }
}, [documentId, question, detectedDocType, detectionReason, confirmedDocType, academicLevel, outline, sessionContext, step]);
  
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
  setActiveSection(null);
  setGeneratingSection(null);
  setSectionDraft(null);
  setStep('input');
}, [documentId]);

  const analyseQuestion = useCallback(async () => {
    if (!question.trim()) return;
    setAnalysing(true);
    try {
      const system = `You are an academic assignment analyser. Read the student's assignment question, detect if it is single or multi-part, and identify the most appropriate document type.

Allowed doc types: "essay", "research_paper", "report", "general".

Respond with ONLY a JSON object (no prose, no markdown fences) of the exact shape:
{
  "detectedDocType": "essay" | "research_paper" | "report" | "general",
  "reason": "one short sentence explaining why",
  "suggestedTotalWords": number,
  "outlineSections": [
    { "heading": "string", "guidanceTip": "short actionable guidance", "wordCountSuggestion": number }
  ]
}

Make 4-8 outline sections. Headings must be specific to the assignment, not generic.`;
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
      setOutline(
        parsed.outlineSections.map((s: any, i: number) => ({
          id: `sec-${i}-${Date.now()}`,
          heading: String(s.heading ?? `Section ${i + 1}`),
          guidanceTip: String(s.guidanceTip ?? ''),
          wordCountSuggestion: Number(s.wordCountSuggestion) || 200,
        })),
      );
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

  const generateSection = useCallback(
    async (heading: string) => {
      const section = outline.find((s) => s.heading === heading);
      if (!section) return;
      setGeneratingSection(heading);
      try {
        const system = `You are writing one section of a ${confirmedDocType ?? 'essay'} for a ${
          academicLevel ?? 'university'
        } student. The assignment question is: ${sessionContext}. Write only the '${heading}' section. Length: approximately ${
          section.wordCountSuggestion
        } words. Be thorough, academic, and original. Do not include the heading itself in your response — only the section body as paragraphs.`;
        const content = await callChat([
          { role: 'system', content: system },
          { role: 'user', content: `Write the '${heading}' section now.` },
        ]);
        if (!content.trim()) throw new Error('empty');
        setSectionDraft({ heading, content: content.trim() });
      } catch {
        toast.error('Failed to generate section — try again');
      } finally {
        setGeneratingSection(null);
      }
    },
    [outline, confirmedDocType, academicLevel, sessionContext],
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

  // Track active section based on cursor position
  useEffect(() => {
    if (!editor || step !== 'outline_ready') return;
    const update = () => {
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
    };
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    update();
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
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
