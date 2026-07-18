-- Ejecutar este script en el editor SQL de Supabase para actualizar la base de datos existente con los nuevos campos de moderación.

ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
