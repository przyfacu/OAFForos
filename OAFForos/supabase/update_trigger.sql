-- Ejecuta este script en el SQL Editor de tu proyecto Supabase para actualizar la función del disparador (trigger)
-- que maneja la creación de nuevos usuarios. Esto permitirá almacenar el username personalizado
-- proporcionado durante el registro en lugar de generar uno automáticamente a partir del correo.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  val_username text;
begin
  val_username := new.raw_user_meta_data->>'username';
  if val_username is null or val_username = '' then
    val_username := coalesce(nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'miembro') || '_' || substr(new.id::text,1,6);
  end if;
  insert into public.profiles(id, username, display_name)
  values (new.id, val_username, coalesce(new.raw_user_meta_data->>'full_name', val_username));
  return new;
end; $$;
