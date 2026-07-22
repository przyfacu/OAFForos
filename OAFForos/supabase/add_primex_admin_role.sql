-- Ejecutar una vez en proyectos Supabase ya existentes.
-- El valor técnico del rol es "primex_admin" y la interfaz lo muestra como
-- "Primex del admin". Tiene exactamente los permisos de un moderador.

alter type public.app_role add value if not exists 'primex_admin' after 'moderator';

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      -- La conversión a texto permite ejecutar este script completo en una
      -- única transacción, justo después de agregar el valor al enum.
      and role::text in ('moderator', 'primex_admin', 'admin')
  )
$$;
