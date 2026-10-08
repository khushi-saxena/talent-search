-- Core schema: tenants, candidates, searches, shortlists, saved briefs, billing.

create table public.companies (
  id text primary key,
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  searches_used int not null default 0
);

create table public.recruiters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_id text not null references public.companies (id)
);

create table public.candidates (
  id text primary key,
  full_name text not null,
  avatar_url text,
  headline text,
  current_title text,
  current_company text,
  current_company_logo_url text,
  role text not null,
  seniority text not null,
  years_experience int not null,
  city text,
  state text,
  country text,
  open_to_work boolean not null default false,
  skills text[] not null default '{}',
  -- flattened from experiences/education so filters are simple array ops
  companies text[] not null default '{}',
  company_types text[] not null default '{}',
  current_company_type text,
  schools text[] not null default '{}',
  degrees text[] not null default '{}',
  fields text[] not null default '{}',
  experiences jsonb not null default '[]',
  education jsonb not null default '[]'
);

create index candidates_role_idx on public.candidates (role);
create index candidates_city_idx on public.candidates (city);
create index candidates_skills_idx on public.candidates using gin (skills);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  brief text not null,
  filters jsonb not null,
  result_ids text[] not null default '{}',
  total int not null default 0,
  created_at timestamptz not null default now()
);
create index searches_company_idx on public.searches (company_id, created_at desc);

create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies (id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index shortlists_company_idx on public.shortlists (company_id);

create table public.shortlist_people (
  shortlist_id uuid not null references public.shortlists (id) on delete cascade,
  candidate_id text not null references public.candidates (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shortlist_id, candidate_id)
);

create table public.saved_briefs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies (id),
  user_id uuid references auth.users (id) on delete set null,
  brief text not null check (char_length(brief) between 1 and 500),
  filters jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index saved_briefs_company_idx on public.saved_briefs (company_id, created_at desc);

create table public.stripe_events (
  id text primary key,
  type text not null,
  created bigint not null,
  received_at timestamptz not null default now()
);

create table public.subscriptions (
  id text primary key,
  company_id text not null references public.companies (id),
  status text not null,
  event_created bigint not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tenancy helper. security definer so policies can read recruiters without
-- recursing through recruiters' own RLS.

create function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.recruiters where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- RLS

alter table public.companies enable row level security;
alter table public.recruiters enable row level security;
alter table public.candidates enable row level security;
alter table public.searches enable row level security;
alter table public.shortlists enable row level security;
alter table public.shortlist_people enable row level security;
alter table public.saved_briefs enable row level security;
alter table public.stripe_events enable row level security;
alter table public.subscriptions enable row level security;

-- Supabase grants everything to anon/authenticated by default. Start from
-- nothing and hand back only what the app needs.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.companies, public.recruiters, public.candidates, public.searches to authenticated;
grant select, insert, update, delete on public.shortlists, public.shortlist_people, public.saved_briefs to authenticated;

create policy "own company" on public.companies
  for select to authenticated using (id = public.current_company_id());

create policy "self" on public.recruiters
  for select to authenticated using (user_id = auth.uid());

create policy "shared" on public.candidates
  for select to authenticated using (true);

create policy "own company" on public.searches
  for select to authenticated using (company_id = public.current_company_id());

create policy "own company" on public.shortlists
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "own company" on public.shortlist_people
  for all to authenticated
  using (exists (
    select 1 from public.shortlists s
    where s.id = shortlist_id and s.company_id = public.current_company_id()
  ))
  with check (exists (
    select 1 from public.shortlists s
    where s.id = shortlist_id and s.company_id = public.current_company_id()
  ));

create policy "own company" on public.saved_briefs
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- company_id is never trusted from the client
create function public.set_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.company_id := public.current_company_id();
    if new.company_id is null then
      raise exception 'not a recruiter' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

create trigger shortlists_company before insert or update on public.shortlists
  for each row execute function public.set_company_id();
create trigger saved_briefs_company before insert or update on public.saved_briefs
  for each row execute function public.set_company_id();

-- ---------------------------------------------------------------------------
-- Search. Filters arrive as jsonb and are only ever used as bind values in
-- static SQL, so nothing in a brief can change the query shape.

create function public.match_candidates(f jsonb)
returns table (id text)
language sql
stable
set search_path = ''
as $$
  with p as (
    select
      array(select jsonb_array_elements_text(coalesce(f->'roles', '[]'))) as roles,
      array(select jsonb_array_elements_text(coalesce(f->'seniority', '[]'))) as seniority,
      array(select jsonb_array_elements_text(coalesce(f->'cities', '[]'))) as cities,
      array(select jsonb_array_elements_text(coalesce(f->'skills', '[]'))) as skills,
      array(select jsonb_array_elements_text(coalesce(f->'nice_to_have_skills', '[]'))) as nice,
      array(select jsonb_array_elements_text(coalesce(f->'companies', '[]'))) as companies,
      array(select jsonb_array_elements_text(coalesce(f->'current_companies', '[]'))) as current_companies,
      array(select jsonb_array_elements_text(coalesce(f->'schools', '[]'))) as schools,
      array(select jsonb_array_elements_text(coalesce(f->'degrees', '[]'))) as degrees,
      array(select jsonb_array_elements_text(coalesce(f->'fields', '[]'))) as fields,
      (f->>'open_to_work')::boolean as open_to_work,
      (f->>'min_years')::int as min_years,
      (f->>'max_years')::int as max_years,
      f->>'worked_at_company_type' as worked_type,
      f->>'current_company_type' as current_type
  )
  select c.id
  from public.candidates c, p
  where (cardinality(p.roles) = 0 or c.role = any (p.roles))
    and (cardinality(p.seniority) = 0 or c.seniority = any (p.seniority))
    and (cardinality(p.cities) = 0 or c.city = any (p.cities))
    and c.skills @> p.skills
    and (cardinality(p.companies) = 0 or c.companies && p.companies)
    and (cardinality(p.current_companies) = 0 or c.current_company = any (p.current_companies))
    and (cardinality(p.schools) = 0 or c.schools && p.schools)
    and (cardinality(p.degrees) = 0 or c.degrees && p.degrees)
    and (cardinality(p.fields) = 0 or c.fields && p.fields)
    and (p.open_to_work is null or c.open_to_work = p.open_to_work)
    and (p.min_years is null or c.years_experience >= p.min_years)
    and (p.max_years is null or c.years_experience <= p.max_years)
    and (p.worked_type is null or p.worked_type = any (c.company_types))
    and (p.current_type is null or c.current_company_type = p.current_type)
  order by
    cardinality(array(select unnest(c.skills) intersect select unnest(p.nice))) desc,
    c.open_to_work desc,
    c.years_experience desc,
    c.id
$$;

-- The fields a results list needs; the full profile comes from /api/people.
create function public.candidate_card(c public.candidates)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'avatar_url', c.avatar_url,
    'headline', c.headline,
    'current_title', c.current_title,
    'current_company', c.current_company,
    'current_company_logo_url', c.current_company_logo_url,
    'role', c.role,
    'seniority', c.seniority,
    'years_experience', c.years_experience,
    'location', jsonb_build_object('city', c.city, 'state', c.state, 'country', c.country),
    'open_to_work', c.open_to_work,
    'skills', to_jsonb(c.skills)
  )
$$;

-- Runs a search for the caller's company and charges it against the plan in
-- the same transaction. The company row lock serialises concurrent calls, so
-- a free company can only ever get one search through.
create function public.create_search(p_brief text, p_filters jsonb, p_match boolean)
returns table (search_id uuid, total int, searches_remaining int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company text := public.current_company_id();
  v_plan text;
  v_used int;
  v_ids text[];
  v_id uuid;
begin
  if v_company is null then
    raise exception 'not a recruiter' using errcode = '42501';
  end if;

  update public.companies c
     set searches_used = c.searches_used + 1
   where c.id = v_company
     and (c.plan = 'paid' or c.searches_used < 1)
  returning c.plan, c.searches_used into v_plan, v_used;

  if not found then
    raise exception 'search limit reached' using errcode = 'P0402';
  end if;

  if p_match then
    select coalesce(array_agg(m.id), '{}') into v_ids from public.match_candidates(p_filters) m;
  else
    v_ids := '{}';
  end if;

  insert into public.searches (company_id, user_id, brief, filters, result_ids, total)
  values (v_company, auth.uid(), left(p_brief, 500), p_filters, v_ids, cardinality(v_ids))
  returning id into v_id;

  return query select v_id, cardinality(v_ids),
    case when v_plan = 'paid' then null else greatest(0, 1 - v_used) end;
end
$$;

-- One page of a stored search. Invoker rights, so RLS on searches decides
-- whether the caller can see it at all.
create function public.search_page(p_search_id uuid, p_page int, p_size int default 20)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'search_id', s.id,
    'brief', s.brief,
    'filters', s.filters,
    'total', s.total,
    'results', coalesce((
      select jsonb_agg(public.candidate_card(c) order by u.ord)
      from unnest(s.result_ids[((p_page - 1) * p_size + 1):(p_page * p_size)]) with ordinality as u(id, ord)
      join public.candidates c on c.id = u.id
    ), '[]')
  )
  from public.searches s
  where s.id = p_search_id and p_page >= 1 and p_size between 1 and 100
$$;

create function public.plan_status()
returns table (plan text, searches_remaining int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.plan, case when c.plan = 'paid' then null else greatest(0, 1 - c.searches_used) end
  from public.companies c
  where c.id = public.current_company_id()
$$;

-- ---------------------------------------------------------------------------
-- Billing. Only the server (service_role) can call this.

create function public.apply_stripe_event(
  p_event_id text,
  p_type text,
  p_created bigint,
  p_subscription_id text,
  p_company text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company text;
begin
  insert into public.stripe_events (id, type, created)
  values (p_event_id, p_type, p_created)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_subscription_id is null then
    return 'ignored';
  end if;

  select id into v_company from public.companies where id = p_company for update;
  if v_company is null then
    return 'unknown company';
  end if;

  -- newest event wins; on a timestamp tie a cancellation wins
  insert into public.subscriptions (id, company_id, status, event_created)
  values (p_subscription_id, v_company, p_status, p_created)
  on conflict (id) do update
    set status = excluded.status,
        event_created = excluded.event_created,
        updated_at = now()
    where excluded.event_created > public.subscriptions.event_created
       or (excluded.event_created = public.subscriptions.event_created
           and excluded.status = 'canceled');

  update public.companies c
     set plan = case when exists (
       select 1 from public.subscriptions s
       where s.company_id = c.id and s.status = 'active'
     ) then 'paid' else 'free' end
   where c.id = v_company;

  return 'applied';
end
$$;

-- nothing is callable over the API unless granted here
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant execute on function public.current_company_id() to authenticated;
grant execute on function public.create_search(text, jsonb, boolean) to authenticated;
grant execute on function public.search_page(uuid, int, int) to authenticated;
grant execute on function public.candidate_card(public.candidates) to authenticated;
grant execute on function public.plan_status() to authenticated;
grant execute on function public.match_candidates(jsonb) to service_role;
grant execute on function public.apply_stripe_event(text, text, bigint, text, text, text) to service_role;
