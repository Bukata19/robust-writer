ALTER TYPE public.doc_type ADD VALUE IF NOT EXISTS 'lab_report';
ALTER TYPE public.doc_type ADD VALUE IF NOT EXISTS 'literature_review';
ALTER TYPE public.doc_type ADD VALUE IF NOT EXISTS 'presentation_outline';
ALTER TYPE public.doc_type ADD VALUE IF NOT EXISTS 'reflective_journal';

CREATE TABLE public.document_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_sources TO authenticated;
GRANT ALL ON public.document_sources TO service_role;

ALTER TABLE public.document_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sources"
  ON public.document_sources FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sources"
  ON public.document_sources FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sources"
  ON public.document_sources FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sources"
  ON public.document_sources FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_document_sources_doc ON public.document_sources (document_id, created_at DESC);