-- OAFForos: Agregar soporte para temas fijados
-- Ejecutar en el SQL Editor de Supabase

-- 1. Agregar columna is_pinned a la tabla topics
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Índice para acelerar el ORDER BY is_pinned DESC, created_at DESC
CREATE INDEX IF NOT EXISTS topics_pinned_idx ON public.topics (is_pinned DESC, created_at DESC);

-- 3. Política RLS ya cubierta por "staff manage topics" (no se necesita nueva).
--    Si aún no existe esa política, crearla con:
-- CREATE POLICY "staff manage topics" ON public.topics FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
