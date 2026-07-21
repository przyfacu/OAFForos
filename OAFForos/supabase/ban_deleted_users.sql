-- Ejecutar una vez después de delete_user_and_content.sql.
-- Conserva el correo de las cuentas eliminadas y evita que se vuelvan a crear.

create table if not exists public.deleted_user_emails (
  email text primary key check (email = lower(email)),
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null
);

alter table public.deleted_user_emails enable row level security;

create or replace function public.reject_deleted_user_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1
    from public.deleted_user_emails
    where email = lower(trim(new.email))
  ) then
    raise exception 'No se puede registrar una cuenta con este correo.';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_deleted_user_email on auth.users;
create trigger reject_deleted_user_email
before insert on auth.users
for each row execute procedure public.reject_deleted_user_email();

create or replace function public.delete_user_and_content(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role public.app_role;
  deleted_rows integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tenés permisos para eliminar usuarios.';
  end if;

  select role into target_role from public.profiles where id = target_user_id;
  if target_role is null then
    raise exception 'El usuario no existe.';
  end if;
  if target_role = 'admin' then
    raise exception 'No se puede eliminar a un administrador desde la aplicación.';
  end if;

  -- Guardar el correo antes de eliminar auth.users. El conflicto es idempotente.
  insert into public.deleted_user_emails (email, deleted_by)
  select lower(trim(email)), auth.uid()
  from auth.users
  where id = target_user_id and email is not null
  on conflict (email) do nothing;

  -- Quitar referencias que no tienen borrado en cascada.
  update public.archive_proposals set reviewer_id = null where reviewer_id = target_user_id;
  update public.reports set resolved_by = null where resolved_by = target_user_id;
  delete from public.archive_proposals where author_id = target_user_id;

  -- Los borrados en cascada eliminan adjuntos y reportes asociados a contenido.
  delete from public.replies where author_id = target_user_id;
  delete from public.topics where author_id = target_user_id;
  delete from public.reports where reporter_id = target_user_id;

  delete from auth.users where id = target_user_id;
  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'No se pudo eliminar la cuenta de autenticación.';
  end if;
  return true;
end;
$$;

revoke all on function public.delete_user_and_content(uuid) from public;
grant execute on function public.delete_user_and_content(uuid) to authenticated;
