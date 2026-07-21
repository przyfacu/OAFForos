-- Ejecutar una vez en proyectos Supabase ya creados.
-- Permite que un mismo número exista en un nivel si uno es teórico y el otro experimental.

do $$
begin
  create type public.problem_kind as enum ('theoretical', 'experimental');
exception
  when duplicate_object then null;
end $$;

alter table public.problems
  add column if not exists kind public.problem_kind;

update public.problems
set kind = 'theoretical'
where kind is null;

alter table public.problems
  alter column kind set default 'theoretical',
  alter column kind set not null;

alter table public.problems
  drop constraint if exists problems_level_id_number_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.problems'::regclass
      and conname = 'problems_level_id_number_kind_key'
  ) then
    alter table public.problems
      add constraint problems_level_id_number_kind_key unique (level_id, number, kind);
  end if;
end $$;
