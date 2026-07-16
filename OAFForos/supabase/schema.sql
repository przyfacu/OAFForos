-- OAFForos: ejecutar en el SQL Editor de un proyecto Supabase vacío.
create extension if not exists pgcrypto;

create type public.app_role as enum ('member', 'moderator', 'admin');
create type public.content_status as enum ('published', 'hidden', 'closed', 'deleted');
create type public.proposal_status as enum ('pending', 'approved', 'rejected', 'changes_requested');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 80),
  bio text check (char_length(bio) <= 500),
  role public.app_role not null default 'member',
  username_set boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  title text not null,
  description text not null,
  position smallint not null default 0,
  is_active boolean not null default true
);
create table public.tags (id uuid primary key default gen_random_uuid(), name text unique not null check (name ~ '^[a-z0-9-]{2,40}$'));
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories(id),
  author_id uuid not null references public.profiles(id),
  problem_id uuid unique,
  title text not null check (char_length(title) between 8 and 160),
  body text not null check (char_length(body) between 20 and 20000),
  status public.content_status not null default 'published',
  search_vector tsvector generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(body,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.topic_tags (topic_id uuid references public.topics(id) on delete cascade, tag_id uuid references public.tags(id) on delete cascade, primary key(topic_id, tag_id));
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 20000),
  is_spoiler boolean not null default false,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competition_types (id uuid primary key default gen_random_uuid(), title text unique not null, position smallint not null default 0);
create table public.competitions (
  id uuid primary key default gen_random_uuid(), type_id uuid not null references public.competition_types(id),
  title text not null, description text, source_url text check (source_url is null or source_url ~ '^https?://'),
  position smallint not null default 0, unique(type_id,title)
);
create table public.editions (
  id uuid primary key default gen_random_uuid(), competition_id uuid not null references public.competitions(id),
  year smallint check (year between 1900 and 2100), title text not null, position smallint not null default 0, unique(competition_id,title)
);
create table public.levels (
  id uuid primary key default gen_random_uuid(), edition_id uuid not null references public.editions(id),
  title text not null, position smallint not null default 0, unique(edition_id,title)
);
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id),
  number smallint not null check (number > 0),
  title text not null,
  statement text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  image_path text,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(level_id, number)
);
alter table public.topics add constraint topics_problem_id_fkey foreign key (problem_id) references public.problems(id) on delete set null;

create table public.archive_proposals (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  status public.proposal_status not null default 'pending',
  reviewer_id uuid references public.profiles(id),
  reviewer_note text check (char_length(reviewer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  topic_id uuid references public.topics(id) on delete cascade,
  reply_id uuid references public.replies(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((topic_id is not null)::int + (reply_id is not null)::int = 1)
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin')) $$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  val_username text;
  val_username_set boolean;
begin
  val_username := new.raw_user_meta_data->>'username';
  if val_username is null or val_username = '' then
    val_username := coalesce(nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'miembro') || '_' || substr(new.id::text,1,6);
    val_username_set := false;
  else
    val_username_set := true;
  end if;
  insert into public.profiles(id, username, display_name, username_set)
  values (new.id, val_username, coalesce(new.raw_user_meta_data->>'full_name', val_username), val_username_set);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger topics_updated before update on public.topics for each row execute procedure public.touch_updated_at();
create trigger replies_updated before update on public.replies for each row execute procedure public.touch_updated_at();
create trigger problems_updated before update on public.problems for each row execute procedure public.touch_updated_at();

-- Seguridad: habilitar RLS para toda tabla expuesta.
alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.tags enable row level security; alter table public.topics enable row level security; alter table public.topic_tags enable row level security; alter table public.replies enable row level security; alter table public.competition_types enable row level security; alter table public.competitions enable row level security; alter table public.editions enable row level security; alter table public.levels enable row level security; alter table public.problems enable row level security; alter table public.archive_proposals enable row level security; alter table public.reports enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id and role = (select role from public.profiles p where p.id=auth.uid()));
create policy "staff update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "public read categories" on public.categories for select using (is_active or public.is_staff());
create policy "staff manage categories" on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy "public read tags" on public.tags for select using (true);
create policy "staff manage tags" on public.tags for all using (public.is_staff()) with check (public.is_staff());
create policy "read published topics" on public.topics for select using (status in ('published','closed') or author_id=auth.uid() or public.is_staff());
create policy "members create topics" on public.topics for insert with check (auth.uid()=author_id and status='published');
create policy "authors update topics" on public.topics for update using (auth.uid()=author_id and status='published') with check (auth.uid()=author_id and status='published');
create policy "staff manage topics" on public.topics for all using (public.is_staff()) with check (public.is_staff());
create policy "read tags on visible topics" on public.topic_tags for select using (exists(select 1 from public.topics t where t.id=topic_id and (t.status in ('published','closed') or t.author_id=auth.uid() or public.is_staff())));
create policy "authors tag own topic" on public.topic_tags for insert with check (exists(select 1 from public.topics t where t.id=topic_id and t.author_id=auth.uid()));
create policy "authors untag own topic" on public.topic_tags for delete using (exists(select 1 from public.topics t where t.id=topic_id and t.author_id=auth.uid()));
create policy "staff manage topic tags" on public.topic_tags for all using (public.is_staff()) with check (public.is_staff());
create policy "read published replies" on public.replies for select using (status='published' or author_id=auth.uid() or public.is_staff());
create policy "members create replies" on public.replies for insert with check (auth.uid()=author_id and status='published' and exists(select 1 from public.topics t where t.id=topic_id and t.status='published'));
create policy "authors update replies" on public.replies for update using (auth.uid()=author_id and status='published') with check (auth.uid()=author_id and status='published');
create policy "staff manage replies" on public.replies for all using (public.is_staff()) with check (public.is_staff());
create policy "public read archive types" on public.competition_types for select using (true); create policy "public read competitions" on public.competitions for select using (true); create policy "public read editions" on public.editions for select using (true); create policy "public read levels" on public.levels for select using (true); create policy "public read published problems" on public.problems for select using (status='published' or public.is_staff());
create policy "staff manage archive types" on public.competition_types for all using (public.is_staff()) with check (public.is_staff()); create policy "staff manage competitions" on public.competitions for all using (public.is_staff()) with check (public.is_staff()); create policy "staff manage editions" on public.editions for all using (public.is_staff()) with check (public.is_staff()); create policy "staff manage levels" on public.levels for all using (public.is_staff()) with check (public.is_staff()); create policy "staff manage problems" on public.problems for all using (public.is_staff()) with check (public.is_staff());
create policy "members create proposals" on public.archive_proposals for insert with check (auth.uid()=author_id and status='pending'); create policy "authors read own proposals" on public.archive_proposals for select using (auth.uid()=author_id or public.is_staff()); create policy "staff review proposals" on public.archive_proposals for update using (public.is_staff()) with check (public.is_staff());
create policy "members create reports" on public.reports for insert with check (auth.uid()=reporter_id); create policy "staff read reports" on public.reports for select using (public.is_staff()); create policy "staff resolve reports" on public.reports for update using (public.is_staff()) with check (public.is_staff());

-- Cree el bucket 'problem-images' como privado desde Storage. Políticas de ejemplo:
-- create policy "public read approved images" on storage.objects for select using (bucket_id = 'problem-images');
-- create policy "members upload images" on storage.objects for insert to authenticated with check (bucket_id = 'problem-images' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.categories(id,title,description,position) values
('mecanica','Mecánica','Movimiento, fuerzas, conservación y sistemas.',1),('electromagnetismo','Electromagnetismo','Campos, circuitos e inducción.',2),('termodinamica','Termodinámica','Equilibrio, procesos y estadística.',3),('ondas','Ondas y óptica','Oscilaciones, interferencia y óptica.',4),('moderna','Física moderna','Relatividad, cuántica y nuclear.',5),('comunidad','Comunidad','Presentaciones y recursos.',6);

