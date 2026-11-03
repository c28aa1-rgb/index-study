-- Dalton Index schema. Apply to the app's Supabase project.

create or replace function public.valid_study_cards(value jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  card jsonb;
  ids text[] := '{}';
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) not between 2 and 1000 then return false; end if;
  for card in select jsonb_array_elements(value) loop
    if jsonb_typeof(card) is distinct from 'object'
      or jsonb_typeof(card->'id') is distinct from 'string'
      or jsonb_typeof(card->'term') is distinct from 'string'
      or jsonb_typeof(card->'definition') is distinct from 'string'
    then return false; end if;
    if length(btrim(card->>'id')) not between 1 and 200
      or length(btrim(card->>'term')) not between 1 and 20000
      or length(btrim(card->>'definition')) not between 1 and 20000
      or (card->>'id') = any(ids)
    then return false; end if;
    ids := array_append(ids, card->>'id');
  end loop;
  return true;
end;
$$;

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '' check (length(author_name) <= 200),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  cards jsonb not null check (public.valid_study_cards(cards)),
  visibility text not null default 'unlisted' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_sets_owner_idx on public.study_sets (owner_id, updated_at desc);
create index if not exists study_sets_public_idx on public.study_sets (visibility, updated_at desc);
alter table public.study_sets enable row level security;

-- Public/unlisted sets can be read with a link; private sets require their owner.
drop policy if exists "read sets" on public.study_sets;
create policy "read sets" on public.study_sets for select to anon, authenticated
  using (visibility in ('public', 'unlisted') or owner_id = (select auth.uid()));

drop policy if exists "insert own sets" on public.study_sets;
create policy "insert own sets" on public.study_sets for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "update own sets" on public.study_sets;
create policy "update own sets" on public.study_sets for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "delete own sets" on public.study_sets;
create policy "delete own sets" on public.study_sets for delete to authenticated
  using (owner_id = (select auth.uid()));

create table if not exists public.study_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id)
);
create index if not exists study_progress_set_idx on public.study_progress(set_id);
alter table public.study_progress enable row level security;

drop policy if exists "own progress" on public.study_progress;
create policy "own progress" on public.study_progress for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.study_sets where id = set_id));

revoke all on public.study_sets, public.study_progress from public, anon, authenticated;
grant select on public.study_sets to anon;
grant select, insert, update, delete on public.study_sets, public.study_progress to authenticated;
