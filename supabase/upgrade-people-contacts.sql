-- Adds contact info to RentFolio: an optional phone for the main
-- applicant and an email/phone pair for each other person on the
-- application, shown to the landlord next to their documents.
-- Run this in the Supabase SQL Editor if your database was created
-- before this feature. Additive only; safe to run more than once.

alter table public.applicants
  add column if not exists phone text;

create table if not exists public.application_people (
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  person_name text not null,
  email text,
  phone text,
  primary key (applicant_id, person_name)
);

alter table public.application_people enable row level security;
