import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, History, RotateCcw, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

interface Version {
  id: string;
  title: string;
  content: Json | null;
  created_at: string;
}

interface VersionHistoryPanelProps {
  documentId: string;
  onRestore: (content: string, title: string) => void;
  onClose: () => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ documentId, onRestore, onClose }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('document_versions')
      .select('id, title, content, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast.error('Failed to load version history');
    } else {
      setVersions((data as unknown as Version[]) || []);
    }
    setLoading(false);
  };

  const handleRestore = (version: Version) => {
    const content = typeof version.content === 'string' ? version.content : '';
    onRestore(content, version.title);
    toast.success('Version restored! Remember to save.');
  };

  const previewVersion = previewId ? versions.find(v => v.id === previewId) : null;

  return (
    <div className="flex flex-col h-full glass-panel">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Version History</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <History className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No saved versions yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Versions are created each time you save.</p>
        </div>
      ) : previewVersion ? (
        <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs font-medium text-foreground">{previewVersion.title}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(previewVersion.created_at), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>
              Back
            </Button>
          </div>
          <div
            className="flex-1 overflow-y-auto p-4 prose prose-sm prose-invert max-w-none text-foreground scrollbar-dark"
            dangerouslySetInnerHTML={{ __html: typeof previewVersion.content === 'string' ? previewVersion.content : '' }}
          />
          <div className="p-3 border-t border-border shrink-0">
            <Button size="sm" className="w-full btn-glow" onClick={() => handleRestore(previewVersion)}>
              <RotateCcw className="w-3 h-3 mr-1" /> Restore this version
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-dark">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between px-3 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{v.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(v.created_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewId(v.id)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestore(v)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;
