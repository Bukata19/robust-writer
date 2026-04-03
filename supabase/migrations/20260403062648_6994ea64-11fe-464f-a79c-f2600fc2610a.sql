
DROP POLICY IF EXISTS "Users can create their own versions" ON public.document_versions;

CREATE POLICY "Users can create their own versions"
ON public.document_versions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_versions.document_id
      AND documents.user_id = auth.uid()
  )
);
