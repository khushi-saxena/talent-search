-- Candidates and recruiter logins are loaded by scripts/seed.ts (needs the auth API).
insert into public.companies (id, name) values
  ('acme', 'Acme'),
  ('globex', 'Globex')
on conflict (id) do nothing;
