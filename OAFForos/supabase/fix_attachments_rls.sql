-- Corrige una instalación existente: impide modificar metadatos de adjuntos
-- que pertenecen a contenido ajeno. Ejecutar una sola vez en SQL Editor.
BEGIN;

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_db_authenticated_insert" ON public.attachments;
DROP POLICY IF EXISTS "attachments_db_authenticated_delete" ON public.attachments;
DROP POLICY IF EXISTS "attachments_db_insert_own_content_or_staff" ON public.attachments;
DROP POLICY IF EXISTS "attachments_db_delete_own_content_or_staff" ON public.attachments;

CREATE POLICY "attachments_db_insert_own_content_or_staff"
ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = topic_id AND t.author_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.replies r
    WHERE r.id = reply_id AND r.author_id = auth.uid()
  )
);

CREATE POLICY "attachments_db_delete_own_content_or_staff"
ON public.attachments
FOR DELETE TO authenticated
USING (
  public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = topic_id AND t.author_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.replies r
    WHERE r.id = reply_id AND r.author_id = auth.uid()
  )
);

COMMIT;
