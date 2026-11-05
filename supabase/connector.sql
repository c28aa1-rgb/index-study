-- Index ChatGPT connector. Additive; direct Google sessions retain existing policies.
create schema if not exists index_private;
revoke all on schema index_private from public, anon;
grant usage on schema index_private to authenticated;

create table if not exists public.study_connector_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.oauth_clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, client_id)
);
create index if not exists study_connector_grants_client_idx on public.study_connector_grants(client_id);
alter table public.study_connector_grants enable row level security;
revoke all on public.study_connector_grants from public, anon, authenticated;
grant select, insert, delete on public.study_connector_grants to authenticated;
create policy "manage own connector grants" on public.study_connector_grants for all to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt())->>'client_id') is null)
  with check (user_id = (select auth.uid()) and ((select auth.jwt())->>'client_id') is null);

create table if not exists index_private.connector_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.oauth_clients(id) on delete cascade,
  request_id uuid not null,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  operation text not null,
  argument_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, client_id, request_id)
);
create index if not exists connector_operations_set_idx on index_private.connector_operations(set_id);
create index if not exists connector_operations_client_idx on index_private.connector_operations(client_id);
alter table index_private.connector_operations enable row level security;
revoke all on index_private.connector_operations from public, anon, authenticated;

-- OAuth tokens cannot bypass the narrow connector by calling the Data API directly.
create policy "no direct OAuth set access" on public.study_sets as restrictive for all to authenticated
  using (((select auth.jwt())->>'client_id') is null)
  with check (((select auth.jwt())->>'client_id') is null);
create policy "no OAuth progress access" on public.study_progress as restrictive for all to authenticated
  using (((select auth.jwt())->>'client_id') is null)
  with check (((select auth.jwt())->>'client_id') is null);
create policy "no OAuth stars access" on public.study_stars as restrictive for all to authenticated
  using (((select auth.jwt())->>'client_id') is null)
  with check (((select auth.jwt())->>'client_id') is null);

-- Provider hook: bind OAuth tokens to this resource while retaining Data API compatibility.
-- Supabase Auth calls this hook; browser and connector clients cannot call it.
create or replace function public.index_connector_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare claims jsonb := event->'claims';
begin
  if nullif(claims->>'client_id', '') is not null then
    claims := jsonb_set(claims, '{aud}', jsonb_build_array('authenticated', 'https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp'));
    event := jsonb_set(event, '{claims}', claims);
  end if;
  return event;
end;
$$;
revoke all on function public.index_connector_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.index_connector_token_hook(jsonb) to supabase_auth_admin;

-- SECURITY DEFINER is intentional: OAuth is denied all raw table access above.
-- This private, fixed-operation capability checks live consent/session/ownership itself.
-- No service key is used by the Edge Function, no dynamic SQL or arbitrary table access.
create or replace function index_private.study_connector(operation text, arguments jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<connector>>
declare
  uid uuid := auth.uid();
  claims jsonb := auth.jwt();
  cid uuid;
  sid uuid;
  rid uuid;
  found_set public.study_sets%rowtype;
  previous index_private.connector_operations%rowtype;
  output jsonb;
  cards jsonb;
  additions jsonb := '[]'::jsonb;
  removals jsonb := coalesce(arguments->'remove_card_ids', '[]'::jsonb);
  entry jsonb;
  page_offset integer := coalesce((arguments->>'offset')::integer, 0);
  page_limit integer := coalesce((arguments->>'limit')::integer, 100);
  n integer;
  existing_revision timestamptz;
  argument_hash text := encode(sha256(convert_to(arguments::text, 'UTF8')), 'hex');
begin
  if uid is null or nullif(claims->>'client_id','') is null or nullif(claims->>'session_id','') is null
    or not (claims->'aud' @> '"https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp"'::jsonb)
  then raise exception using errcode='42501', message='Connect your Index account.'; end if;
  cid := (claims->>'client_id')::uuid;
  sid := (claims->>'session_id')::uuid;
  if not exists (select 1 from public.study_connector_grants g where g.user_id=uid and g.client_id=cid)
    or not exists (select 1 from auth.sessions s where s.id=sid and s.user_id=uid and s.oauth_client_id=cid and s.created_at >= (select g.created_at from public.study_connector_grants g where g.user_id=uid and g.client_id=cid) and 'openid'=any(string_to_array(s.scopes,' ')) and (s.not_after is null or s.not_after > now()))
    or not exists (select 1 from auth.oauth_consents c where c.user_id=uid and c.client_id=cid and c.revoked_at is null)
  then raise exception using errcode='42501', message='Your Index connection was disconnected. Reconnect your account.'; end if;
  if jsonb_typeof(arguments) is distinct from 'object' or octet_length(arguments::text)>1048576
    or page_offset<0 or page_offset>1000000 or page_limit not between 1 and 100
  then raise exception using errcode='22023', message='Invalid request.'; end if;

  if operation='find_study_sets' then
    if length(coalesce(arguments->>'query',''))>200 then raise exception using errcode='22023', message='Search is too long.'; end if;
    select jsonb_build_object('sets',coalesce(jsonb_agg(v.item order by v.updated_at desc,v.id),'[]'::jsonb), 'offset',page_offset, 'next_offset',case when count(*)=50 then page_offset+50 else null end)
    into output from (
      select s.id, s.updated_at, jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'card_count',jsonb_array_length(s.cards),'updated_at',s.updated_at,'url','https://c28aa1-rgb.github.io/index-study/#/set/'||s.id) item
      from public.study_sets s where s.owner_id=uid and strpos(lower(s.title),lower(coalesce(arguments->>'query','')))>0
      order by s.updated_at desc,s.id offset page_offset limit 50
    ) v;
    return output;
  end if;

  if operation='get_study_set' then
    select * into found_set from public.study_sets s where s.id=(arguments->>'set_id')::uuid and s.owner_id=uid;
    if not found then raise exception using errcode='22023', message='Set not found in your library.'; end if;
    select coalesce(jsonb_agg(c.card order by c.ordinality),'[]'::jsonb) into cards
      from jsonb_array_elements(found_set.cards) with ordinality c(card,ordinality) where c.ordinality>page_offset and c.ordinality<=page_offset+page_limit;
    return jsonb_build_object('id',found_set.id,'title',found_set.title,'description',found_set.description,'visibility',found_set.visibility,'updated_at',found_set.updated_at,'card_count',jsonb_array_length(found_set.cards),'cards',cards,'offset',page_offset,'next_offset',case when page_offset+page_limit<jsonb_array_length(found_set.cards) then page_offset+page_limit else null end,'url','https://c28aa1-rgb.github.io/index-study/#/set/'||found_set.id);
  end if;
  if operation not in ('create_study_set','edit_study_cards') then raise exception using errcode='22023',message='Unknown operation.'; end if;
  if nullif(arguments->>'request_id','') is null then raise exception using errcode='22023',message='Supply a UUID request_id for safe retries.'; end if;
  rid := (arguments->>'request_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||cid::text||rid::text,0));
  select * into previous from index_private.connector_operations o where o.user_id=uid and o.client_id=cid and o.request_id=rid;
  if found then
    if previous.operation<>operation or previous.argument_hash<>argument_hash then raise exception using errcode='22023',message='This request_id was already used for a different change. Use a new UUID.'; end if;
    return previous.result;
  end if;
  cards := case when operation='create_study_set' then arguments->'cards' else coalesce(arguments->'add','[]'::jsonb) end;
  if jsonb_typeof(cards) is distinct from 'array' or jsonb_array_length(cards)>1000 then raise exception using errcode='22023',message='Supply an array of up to 1000 cards.'; end if;
  for entry in select jsonb_array_elements(cards) loop
    if jsonb_typeof(entry->'term') is distinct from 'string' or jsonb_typeof(entry->'definition') is distinct from 'string'
      or length(btrim(entry->>'term')) not between 1 and 20000 or length(btrim(entry->>'definition')) not between 1 and 20000
    then raise exception using errcode='22023',message='Every card needs a term and definition, each under 20000 characters.'; end if;
    additions := additions || jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'term',btrim(entry->>'term'),'definition',btrim(entry->>'definition')));
  end loop;
  if operation='create_study_set' then
    if jsonb_typeof(arguments->'title') is distinct from 'string' or length(btrim(arguments->>'title')) not between 1 and 200 or length(coalesce(arguments->>'description',''))>5000 or jsonb_array_length(additions)<2
    then raise exception using errcode='22023',message='Use a title of 1–200 characters, description under 5000 characters, and at least 2 cards.'; end if;
    insert into public.study_sets(owner_id,title,description,cards,visibility,author_name)
      values(uid,btrim(arguments->>'title'),coalesce(arguments->>'description',''),additions,'private',coalesce((select left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','You'),200) from auth.users u where u.id=uid),'You'))
      returning * into found_set;
    output := jsonb_build_object('id',found_set.id,'title',found_set.title,'card_count',jsonb_array_length(found_set.cards),'visibility','private','updated_at',found_set.updated_at,'url','https://c28aa1-rgb.github.io/index-study/#/set/'||found_set.id);
  else
    if jsonb_typeof(removals) is distinct from 'array' or jsonb_array_length(removals)>1000 then raise exception using errcode='22023',message='Supply an array of card IDs to remove.'; end if;
    if exists(select 1 from jsonb_array_elements(removals) e where jsonb_typeof(e) is distinct from 'string' or length(e#>>'{}') not between 1 and 200)
      or (select count(*)<>count(distinct e) from jsonb_array_elements(removals) e)
    then raise exception using errcode='22023',message='Use unique, exact card IDs from get_study_set.'; end if;
    if jsonb_array_length(removals)+jsonb_array_length(additions)=0 then raise exception using errcode='22023',message='Supply cards to add or remove.'; end if;
    select * into found_set from public.study_sets s where s.id=(arguments->>'set_id')::uuid and s.owner_id=uid for update;
    if not found then raise exception using errcode='22023',message='Set not found in your library.'; end if;
    existing_revision := (arguments->>'expected_updated_at')::timestamptz;
    if existing_revision is null or found_set.updated_at<>existing_revision then raise exception using errcode='40001',message='This set changed since you read it. Read it again and review the edit before retrying.'; end if;
    select count(*) into n from jsonb_array_elements(found_set.cards) c where removals ? (c->>'id');
    if n<>jsonb_array_length(removals) then raise exception using errcode='22023',message='A card ID was not found. Read the set again before removing cards.'; end if;
    select coalesce(jsonb_agg(c order by ordinality),'[]'::jsonb) into cards from jsonb_array_elements(found_set.cards) with ordinality t(c,ordinality) where not(removals ? (c->>'id'));
    cards := cards || additions;
    if not public.valid_study_cards(cards) then raise exception using errcode='22023',message='A set must keep between 2 and 1000 complete cards.'; end if;
    select coalesce(jsonb_agg(c),'[]'::jsonb) into output from jsonb_array_elements(found_set.cards) c where removals ? (c->>'id');
    update public.study_sets s set cards=connector.cards,updated_at=clock_timestamp() where s.id=found_set.id returning * into found_set;
    output := jsonb_build_object('id',found_set.id,'title',found_set.title,'card_count',jsonb_array_length(found_set.cards),'added_cards',additions,'removed_cards',output,'updated_at',found_set.updated_at,'url','https://c28aa1-rgb.github.io/index-study/#/set/'||found_set.id);
  end if;
  insert into index_private.connector_operations(user_id,client_id,request_id,set_id,operation,argument_hash,result)
    values(uid,cid,rid,found_set.id,operation,argument_hash,output);
  return output;
end;
$$;
revoke all on function index_private.study_connector(text,jsonb) from public, anon;
grant execute on function index_private.study_connector(text,jsonb) to authenticated;
create or replace function public.index_study_connector(operation text, arguments jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select index_private.study_connector(operation,arguments); $$;
revoke all on function public.index_study_connector(text,jsonb) from public, anon;
grant execute on function public.index_study_connector(text,jsonb) to authenticated;
