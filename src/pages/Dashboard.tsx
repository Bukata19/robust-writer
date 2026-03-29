import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Plus,
  LogOut,
  FileText,
  BookOpen,
  File,
  Terminal,
  Trash2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

type DocType = 'essay' | 'research_paper' | 'report' | 'general';

interface Document {
  id: string;
  title: string;
  doc_type: DocType;
  plagiarism_score: number | null;
  updated_at: string;
}

const docTypeConfig: Record<DocType, { label: string; icon: React.ReactNode; color: string }> = {
  essay: { label: 'Essay', icon: <FileText className="w-4 h-4" />, color: 'text-teal' },
  research_paper: { label: 'Research Paper', icon: <BookOpen className="w-4 h-4" />, color: 'text-primary' },
  report: { label: 'Report', icon: <File className="w-4 h-4" />, color: 'text-slate' },
  general: { label: 'General', icon: <File className="w-4 h-4" />, color: 'text-muted-foreground' },
};

const getPlagiarismBadge = (score: number | null) => {
  if (score === null || score === 0) return null;
  if (score <= 15) return { label: `${score}% Clean`, className: 'bg-teal/20 text-teal' };
  if (score <= 40) return { label: `${score}% Warning`, className: 'bg-yellow-500/20 text-yellow-400' };
  return { label: `${score}% High Risk`, className: 'bg-destructive/20 text-destructive' };
};

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocType | 'all'>('all');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, doc_type, plagiarism_score, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Failed to load documents');
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const createDocument = async (docType: DocType) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('documents')
      .insert({ user_id: user.id, doc_type: docType, title: 'Untitled Document' })
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to create document');
    } else if (data) {
      navigate(`/editor/${data.id}`);
    }
  };

  const deleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success('Document deleted');
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || doc.doc_type === filterType;
    return matchesSearch && matchesType;
  });
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Terminal className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">RobAssister</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* New Document */}
        <div className="mb-8">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">New Document</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['essay', 'research_paper', 'report', 'general'] as DocType[]).map((type) => {
              const config = docTypeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => createDocument(type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Documents */}
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Your Documents</h2>

        {/* Search and filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-1">
            {(['all', 'essay', 'research_paper', 'report', 'general'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  filterType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'all' ? 'All' : type === 'research_paper' ? 'Research' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{search || filterType !== 'all' ? 'No documents match your search.' : 'No documents yet. Create one above!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              const config = docTypeConfig[doc.doc_type];
              const badge = getPlagiarismBadge(doc.plagiarism_score);
              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/editor/${doc.id}`)}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer group animate-fade-in"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {config.label}
                      </span>
                    </div>
                    <button
                      onClick={(e) => deleteDocument(doc.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-medium text-foreground mb-3 truncate">{doc.title}</h3>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                    {badge && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${badge.className}`}>
                        <ShieldCheck className="w-3 h-3" />
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
  
