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
  10485760,               -- límite: 10 MB por archivo
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
ON CONFLICT (id) DO NOTHING;


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
