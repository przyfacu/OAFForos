-- Establece en 5 MB el límite por archivo del bucket de adjuntos existente.
-- Ejecutá este script una vez en el SQL Editor de Supabase.
UPDATE storage.buckets
SET file_size_limit = 5242880 -- 5 × 1024 × 1024 bytes
WHERE id = 'attachments';
