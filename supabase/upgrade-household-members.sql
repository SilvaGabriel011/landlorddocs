-- Adds household members to RentFolio: one applicant account can now hold
-- documents for several people (the main applicant plus spouse, mother,
-- guarantor, ...), each marked as living in the home or as a supporter.
-- Also removes the old landlord-login policies: the landlord now views
-- without an account, so all reads go through the app server.
--
-- Run this in the Supabase SQL Editor if you already ran schema.sql
-- before this feature existed. Additive + policy cleanup only; no data
-- is deleted. Safe to run more than once.

alter table public.documents
  add column if not exists person_name text;

alter table public.documents
  add column if not exists person_role text
    check (person_role in ('resident', 'supporter') or person_role is null);

drop policy if exists "Landlords read applicants" on public.applicants;
drop policy if exists "Landlords read documents" on public.documents;
