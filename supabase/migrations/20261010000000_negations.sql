-- Negations: "never worked at a startup", "doesn't know Java", "not from Globalcorp".

create or replace function public.match_candidates(f jsonb)
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
      array(select jsonb_array_elements_text(coalesce(f->'excluded_skills', '[]'))) as excluded_skills,
      array(select jsonb_array_elements_text(coalesce(f->'excluded_companies', '[]'))) as excluded_companies,
      (f->>'open_to_work')::boolean as open_to_work,
      (f->>'min_years')::int as min_years,
      (f->>'max_years')::int as max_years,
      f->>'worked_at_company_type' as worked_type,
      f->>'current_company_type' as current_type,
      f->>'never_worked_at_company_type' as never_type
  )
  select c.id
  from public.candidates c, p
  where (cardinality(p.roles) = 0 or c.role = any (p.roles))
    and (cardinality(p.seniority) = 0 or c.seniority = any (p.seniority))
    and (cardinality(p.cities) = 0 or c.city = any (p.cities))
    and c.skills @> p.skills
    and not (c.skills && p.excluded_skills)
    and (cardinality(p.companies) = 0 or c.companies && p.companies)
    and not (c.companies && p.excluded_companies)
    and (cardinality(p.current_companies) = 0 or c.current_company = any (p.current_companies))
    and (cardinality(p.schools) = 0 or c.schools && p.schools)
    and (cardinality(p.degrees) = 0 or c.degrees && p.degrees)
    and (cardinality(p.fields) = 0 or c.fields && p.fields)
    and (p.open_to_work is null or c.open_to_work = p.open_to_work)
    and (p.min_years is null or c.years_experience >= p.min_years)
    and (p.max_years is null or c.years_experience <= p.max_years)
    and (p.worked_type is null or p.worked_type = any (c.company_types))
    and (p.current_type is null or c.current_company_type = p.current_type)
    and (p.never_type is null or not (p.never_type = any (c.company_types)))
  order by
    cardinality(array(select unnest(c.skills) intersect select unnest(p.nice))) desc,
    c.open_to_work desc,
    c.years_experience desc,
    c.id
$$;

-- create or replace keeps grants, but be explicit
revoke all on function public.match_candidates(jsonb) from public, anon, authenticated;
grant execute on function public.match_candidates(jsonb) to service_role;
