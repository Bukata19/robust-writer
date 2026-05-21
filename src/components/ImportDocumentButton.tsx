import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ── TYPES ──────────────────────────────────────────────────────────────────
type DocType = 'essay' | 'research_paper' | 'report' | 'general';

interface ImportDocumentButtonProps {
  onImported?: () => void;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function detectDocType(filename: string): DocType {
  const lower = filename.toLowerCase();
  if (lower.includes('essay')) return 'essay';
  if (lower.includes('report')) return 'report';
  if (lower.includes('research') || lower.includes('paper')) return 'research_paper';
  return 'general';
}

function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── TXT → TIPTAP JSON ──────────────────────────────────────────────────────
function parseTxtToTipTap(text: string): { doc: any; title: string } {
  const rawLines = text.split('\n');
  const content: any[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join(' ').trim();
    if (joined) content.push({ type: 'paragraph', content: [{ type: 'text', text: joined }] });
    buffer = [];
  };

  for (const line of rawLines) {
    if (line.trim() === '') { flush(); } else { buffer.push(line.trim()); }
  }
  flush();

  if (content.length === 0) content.push({ type: 'paragraph' });

  const firstText = content[0]?.content?.[0]?.text ?? '';
  const title = firstText.length > 80 ? firstText.slice(0, 80).trimEnd() + '…' : firstText;
  return { doc: { type: 'doc', content }, title };
}

// ── INLINE MARKS ───────────────────────────────────────────────────────────
function parseInline(line: string): any[] {
  const nodes: any[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match[1] !== undefined) nodes.push({ type: 'text', marks: [{ type: 'bold' }], text: match[1] });
    else if (match[2] !== undefined) nodes.push({ type: 'text', marks: [{ type: 'italic' }], text: match[2] });
    else if (match[3] !== undefined) nodes.push({ type: 'text', text: match[3] });
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text: line }];
}

// ── MD → TIPTAP JSON ───────────────────────────────────────────────────────
function parseMdToTipTap(text: string): { doc: any; title: string } {
  const lines = text.split('\n');
  const content: any[] = [];
  let detectedTitle = '';
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === '') { i++; continue; }

    if (trimmed.startsWith('### ')) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: trimmed.slice(4).trim() }] });
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: trimmed.slice(3).trim() }] });
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      const t = trimmed.slice(2).trim();
      if (!detectedTitle) detectedTitle = t;
      content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: t }] });
      i++; continue;
    }

    if (/^[-*+] /.test(trimmed)) {
      const items: any[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(lines[i].trim().replace(/^[-*+] /, '')) }] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: any[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(lines[i].trim().replace(/^\d+\.\s/, '')) }] });
        i++;
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i].trim()) &&
      !/^[-*+]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      content.push({ type: 'paragraph', content: parseInline(paraLines.join(' ')) });
    }
  }

  if (content.length === 0) content.push({ type: 'paragraph' });
  return { doc: { type: 'doc', content }, title: detectedTitle };
}

// ── DOCX → TIPTAP JSON (no external library) ──────────────────────────────
async function parseDocxToTipTap(buffer: ArrayBuffer): Promise<{ doc: any; title: string }> {
  const bytes = new Uint8Array(buffer);

  const findSeq = (hay: Uint8Array, needle: Uint8Array, start = 0): number => {
    outer: for (let i = start; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) { if (hay[i + j] !== needle[j]) continue outer; }
      return i;
    }
    return -1;
  };

  const enc = new TextEncoder();
  const localSig = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const target = enc.encode('word/document.xml');
  let xmlText = '';
  let pos = 0;

  while (true) {
    const idx = findSeq(bytes, localSig, pos);
    if (idx === -1) break;
    const fnLen = bytes[idx + 26] | (bytes[idx + 27] << 8);
    const extraLen = bytes[idx + 28] | (bytes[idx + 29] << 8);
    const fnBytes = bytes.slice(idx + 30, idx + 30 + fnLen);
    const dataStart = idx + 30 + fnLen + extraLen;
    const compSize = bytes[idx + 18] | (bytes[idx + 19] << 8) | (bytes[idx + 20] << 16) | (bytes[idx + 21] << 24);
    const method = bytes[idx + 8] | (bytes[idx + 9] << 8);

    if (fnBytes.length === target.length && fnBytes.every((b, i) => b === target[i])) {
      const data = bytes.slice(dataStart, dataStart + compSize);
      if (method === 0) {
        xmlText = new TextDecoder().decode(data);
      } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(data); writer.close();
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) { const r = await reader.read(); done = r.done; if (r.value) chunks.push(r.value); }
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const merged = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { merged.set(c, off); off += c.length; }
          xmlText = new TextDecoder().decode(merged);
        } catch { xmlText = ''; }
      }
      break;
    }
    pos = idx + 4;
  }

  if (!xmlText) {
    return {
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Document content could not be extracted. Please paste your content here.' }] }] },
      title: 'Imported Document',
    };
  }

  const plain = xmlText
    .replace(/<w:p[ >][^>]*>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#x[0-9A-Fa-f]+;/g, ' ')
    .replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  return parseTxtToTipTap(plain);
}

// ── COMPONENT ──────────────────────────────────────────────────────────────
const ImportDocumentButton: React.FC<ImportDocumentButtonProps> = ({ onImported }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'md', 'docx'].includes(ext)) {
      toast.error(`Unsupported file type (.${ext}). Please use .txt, .md, or .docx`);
      return;
    }

    setImporting(true);
    try {
      let parsed: { doc: any; title: string };

      if (ext === 'txt') {
        parsed = parseTxtToTipTap(await file.text());
      } else if (ext === 'md') {
        parsed = parseMdToTipTap(await file.text());
      } else {
        parsed = await parseDocxToTipTap(await file.arrayBuffer());
      }

      const title = (parsed.title || filenameToTitle(file.name)).slice(0, 200) || 'Imported Document';
      const docType = detectDocType(file.name);

      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title,
          doc_type: docType,
          content: parsed.doc as any,
        })
        .select('id')
        .single();

      if (error) {
        toast.error('Failed to save imported document. Please try again.');
        return;
      }

      toast.success(`"${title}" imported successfully!`);
      onImported?.();
      navigate(`/editor/${data.id}`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to read the file. Please check it is not corrupted.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.docx"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Import document from file"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
          bg-card border border-border border-dashed
          text-sm font-medium text-muted-foreground
          hover:border-primary/50 hover:text-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200"
      >
        {importing ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Importing…</>
        ) : (
          <><Upload className="w-4 h-4" />Import from file<span className="text-xs text-muted-foreground/60 font-normal ml-1">.txt · .md · .docx</span></>
        )}
      </button>
    </>
  );
};

export default ImportDocumentButton;
