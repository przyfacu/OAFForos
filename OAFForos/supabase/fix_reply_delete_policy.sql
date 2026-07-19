-- Ejecutá este script en el SQL Editor de Supabase para bases ya creadas.
-- Permite que cada autor borre sus propias respuestas publicadas. Moderadores y
-- administradores ya están cubiertos por la política "staff manage replies".

DROP POLICY IF EXISTS "authors delete replies" ON public.replies;

CREATE POLICY "authors delete replies"
ON public.replies
FOR DELETE
USING (auth.uid() = author_id AND status = 'published');
