import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Library, Copy, Check, Trash2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SourceEntry {
  id: string;
  content: string;
  source_label: string | null;
  created_at: string;
}

interface SourceVaultPanelProps {
  documentId: string;
  userId: string | undefined;
  onClose: () => void;
}

const MAX_CONTENT = 4000;

/**
 * Source Vault — per-document storage for quotes, excerpts and notes.
 * Pure CRUD against `document_sources`; no AI calls. Chrome mirrors
 * VersionHistoryPanel so it slides in exactly like the other editor panels.
 */
const SourceVaultPanel: React.FC<SourceVaultPanelProps> = ({ documentId, userId, onClose }) => {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [label, setLabel] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_sources')
        .select('id, content, source_label, created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to load saved sources');
      } else {
        setSources((data as SourceEntry[]) ?? []);
      }
    } catch {
      toast.error('Failed to load saved sources');
    } finally {
      setLoading(false);
    }
  };

  const addSource = async () => {
    const text = content.trim();
    if (!text) {
      toast.error('Add the quote or note first');
      return;
    }
    if (text.length > MAX_CONTENT) {
      toast.error(`Entry exceeds ${MAX_CONTENT.toLocaleString()} characters`);
      return;
    }
    if (!userId) {
      toast.error('Please sign in again');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('document_sources')
        .insert({
          document_id: documentId,
          user_id: userId,
          content: text,
          source_label: label.trim() || null,
        })
        .select('id, content, source_label, created_at')
        .single();
      if (error) throw error;
      setSources((prev) => [data as SourceEntry, ...prev]);
      setContent('');
      setLabel('');
      toast.success('Source saved');
    } catch {
      toast.error('Could not save this source');
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async (sourceId: string) => {
    try {
      const { error } = await supabase.from('document_sources').delete().eq('id', sourceId);
      if (error) throw error;
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      toast.success('Source deleted');
    } catch {
      toast.error('Could not delete this source');
    }
  };

  const copySource = async (entry: SourceEntry) => {
    try {
      await navigator.clipboard.writeText(entry.content);
      setCopiedId(entry.id);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Source Vault</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close source vault" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Add form */}
      <div className="p-3 border-b border-border shrink-0 space-y-2">
        <label htmlFor="source-content" className="block text-xs font-medium text-foreground">
          Quote, excerpt or note
        </label>
        <textarea
          id="source-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the passage you want to keep…"
          className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Where it came from (optional)"
          aria-label="Source label"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          className="w-full btn-glow"
          onClick={addSource}
          disabled={saving || content.trim().length === 0}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin motion-reduce:animate-none" />
          ) : (
            <Plus className="w-3.5 h-3.5 mr-1" />
          )}
          Save source
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <Library className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No saved sources yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Anything you save stays with this document.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-dark">
          {sources.map((s) => (
            <div key={s.id} className="px-3 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors motion-reduce:transition-none">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {s.source_label && (
                    <p className="text-[11px] font-medium text-primary truncate">{s.source_label}</p>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{s.content}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(s.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Copy source"
                    onClick={() => copySource(s)}
                  >
                    {copiedId === s.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    aria-label="Delete source"
                    onClick={() => removeSource(s.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceVaultPanel;
