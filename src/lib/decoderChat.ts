import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export type ChatMessage = { role: string; content: string };

/**
 * Assignment Decoder's transport to the chat Edge Function.
 *
 * Sends `preset: 'decoder'`, which switches the function to the humanizer's
 * proven model pair (anthropic/claude-haiku-3-5 primary, google/gemini-2.0-flash
 * fallback) at a low temperature. Casual Chat sends no preset and is unaffected.
 */
export async function callDecoderChat(messages: ChatMessage[]): Promise<string> {
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
    body: JSON.stringify({ messages, preset: 'decoder' }),
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
        const delta =
          json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? '';
        if (delta) out += delta;
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

export type AnswerLevel = 'high_school' | 'undergraduate' | 'postgraduate' | null;

/**
 * The single source of truth for Answer Mode's system prompt. Shared by the
 * in-editor Answer Mode and the standalone Dashboard tool so the output style
 * is identical in both places (no forked copies of this logic).
 */
export function buildAnswerSystemPrompt(opts: {
  question: string;
  academicLevel?: AnswerLevel;
  field?: string | null;
}): string {
  const { question, academicLevel = null, field = null } = opts;
  const levelLabel =
    academicLevel === 'high_school' ? 'high school'
    : academicLevel === 'undergraduate' ? 'undergraduate'
    : academicLevel === 'postgraduate' ? 'postgraduate'
    : 'general';
  const fieldLine = field
    ? `\nFIELD OF STUDY: ${field}. Use notation, units, and conventions standard in that field.`
    : '';
  return `You are a rigorous problem-solving tutor helping a ${levelLabel} student with a computational / worked-solution assignment.

ORIGINAL ASSIGNMENT QUESTION (context for every reply, do not repeat back verbatim):
${question}
${fieldLine}

HOW TO ANSWER:
- Prioritise correctness and clarity. This is a worked answer, NOT an essay.
- Show the reasoning step by step, in the order a student would work it out. Number the steps when there is more than one.
- State any assumptions you make and why.
- Give the final answer clearly at the end (label it "Answer:" on its own line). Include units where relevant.
- Use plain text math with standard notation (e.g. x^2, sqrt(2), integral from 0 to 1 of ...). Use LaTeX only if the student uses it first.
- If the student pastes multiple sub-questions (e.g. "1a, 1b, 2"), solve each one under its own clearly labelled heading.
- If something in the question is ambiguous, ask ONE clarifying question rather than guessing.
- Do NOT add motivational filler, do NOT vary sentence rhythm for style, do NOT hedge unnecessarily. Be direct.`;
}
