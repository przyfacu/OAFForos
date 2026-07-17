-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Política RLS para que miembros autenticados puedan crear etiquetas (tags)
-- Ejecutá este script en el SQL Editor de tu proyecto Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

-- Problema: la política "staff manage tags" bloqueaba el INSERT de tags a usuarios
-- normales, causando que la publicación de temas con etiquetas fallara silenciosamente
-- o (en algunos casos) arrojara un error que impedía publicar el tema.

-- Solución: agregar una política que permita a usuarios autenticados insertar tags.
-- Los tags son inmutables (solo nombre, sin datos sensibles) y son leídos públicamente,
-- así que es seguro permitir que cualquier miembro autenticado los cree.

-- 1. Permitir que miembros autenticados inserten tags nuevos
CREATE POLICY "members create tags"
  ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. (Opcional) Verificar que las políticas existentes están correctas
-- Si ya existía una política "members create tags", el script anterior falló.
-- En ese caso, ignorar el error y continuar.
