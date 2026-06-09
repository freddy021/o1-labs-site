create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text,
  interest text,
  message text,
  source text default 'o1-labs.com',
  user_agent text
);

comment on table public.contact_submissions is 'Contact form submissions from the o1 Labs marketing site. Writes only via the contact-form Edge Function (service role). RLS enabled with no public policies, so anon/public keys cannot read or write directly.';

-- Enable RLS; intentionally NO policies for anon/authenticated.
-- The Edge Function uses the service_role key, which bypasses RLS.
alter table public.contact_submissions enable row level security;

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);
