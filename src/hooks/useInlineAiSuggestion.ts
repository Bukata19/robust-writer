import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Options {
  editor: Editor | null;
  docType: string | undefined;
  enabled: boolean;
  onSuggestion: (tip: string | null, loading: boolean) => void;
}

export function useInlineAiSuggestion({ editor, docType, enabled, onSuggestion }: Options) {
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastParagraphRef = useRef<string>('');

  useEffect(() => {
    if (!editor || !enabled) return;

    const handler = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      timerRef.current = window.setTimeout(async () => {
        try {
          let paragraphText = '';
          try {
            paragraphText = editor.state.selection.$anchor.node(1)?.textContent ?? '';
          } catch {
            paragraphText = '';
          }
          const words = paragraphText.trim().split(/\s+/).filter(Boolean);
          if (words.length < 15) return;
          if (paragraphText === lastParagraphRef.current) return;
          lastParagraphRef.current = paragraphText;

          onSuggestion(null, true);

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) {
            onSuggestion(null, false);
            return;
          }

          const controller = new AbortController();
          abortRef.current = controller;

          const systemPrompt = `You are a concise writing coach. The user is writing a ${docType ?? 'general'}. Analyse the paragraph they just wrote and respond with ONE short, specific, actionable tip (maximum 12 words). Be direct, not generic. Do not repeat what they wrote. Examples of good tips: 'Back this claim with a specific statistic.', 'Missing a topic sentence — start with your main point.', 'Good argument — now acknowledge a counterpoint.'`;

          const res = await fetch(CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: paragraphText },
              ],
            }),
          });

          if (!res.ok || !res.body) {
            onSuggestion(null, false);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let tip = '';
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? '';
                if (delta) tip += delta;
              } catch {
                /* ignore */
              }
            }
          }

          tip = tip.trim().replace(/^["'`]|["'`]$/g, '');
          if (tip) onSuggestion(tip, false);
          else onSuggestion(null, false);
        } catch {
          onSuggestion(null, false);
        }
      }, 4000);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [editor, enabled, docType, onSuggestion]);
}
