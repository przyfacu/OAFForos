-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Storage: Bucket "attachments"
-- Ejecutá este script en el SQL Editor de Supabase para habilitar la
-- funcionalidad de adjuntos (imágenes, PDFs y archivos) en temas,
-- respuestas y problemas.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Crear el bucket público "attachments"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,                   -- público: las URLs son accesibles sin autenticación
  5242880,                -- límite: 5 MB por archivo
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-zip-compressed'
  ]
)
-- También actualiza el bucket si ya existía con otro límite.
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit;


-- 2. Política: Lectura pública (cualquier visitante puede ver los archivos)
CREATE POLICY "attachments_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'attachments');


-- 3. Política: Subida solo para usuarios autenticados
CREATE POLICY "attachments_authenticated_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'attachments'
  AND auth.role() = 'authenticated'
);


-- 4. Política: Borrado solo para el propietario del archivo
CREATE POLICY "attachments_owner_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'attachments'
  AND auth.uid() = owner
);


-- 5. Crear tabla de metadatos de adjuntos en la base de datos (public.attachments)
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.replies(id) ON DELETE CASCADE,
  problem_id uuid REFERENCES public.problems(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text NOT NULL UNIQUE,
  type text NOT NULL,
  size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_context_check CHECK (
    (topic_id IS NOT NULL)::int +
    (reply_id IS NOT NULL)::int +
    (problem_id IS NOT NULL)::int = 1
  )
);

-- Habilitar RLS en public.attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Política de la base de datos: Lectura pública (cualquier visitante puede leer los metadatos de adjuntos)
CREATE POLICY "attachments_db_public_read"
ON public.attachments
FOR SELECT
USING (true);

-- Sólo el autor del contenido puede asociarle adjuntos. Los enunciados
-- (problems) sólo pueden ser gestionados por staff.
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

-- Sólo el autor del contenido al que pertenece el adjunto puede borrarlo.
-- Esto impide que cualquier usuario autenticado borre metadatos ajenos o
-- adjuntos de enunciados.
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
