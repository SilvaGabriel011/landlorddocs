-- Adds household members to RentFolio: one applicant account can now hold
-- documents for several people (the main applicant plus spouse, mother, ...).
-- Run this in the Supabase SQL Editor if you already ran schema.sql before
-- this feature existed. Safe to run more than once.

alter table public.documents
  add column if not exists person_name text;
