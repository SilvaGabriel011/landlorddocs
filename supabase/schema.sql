-- RentFolio database schema (full install).
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- If you already ran an OLDER version of this file (the share-link model),
-- run upgrade-tenant-login.sql instead of running this again.

-- ============================================================
-- Tables
-- ============================================================

-- Applicants: people applying to rent. They have no Supabase auth account;
-- they sign up with their name + email and sign back in with name + a
-- 4-digit PIN. All their reads and writes go through the app server,
-- which uses the service role key.
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Lowercased name, used as the unique sign-in identifier.
  name_key text not null unique,
  email text not null,
  -- Optional contact number, shown to the landlord.
  phone text,
  created_at timestamptz not null default now()
);

-- Contact info for the OTHER people on an application (the main
-- applicant's contact lives on applicants). Keyed by the person's name
-- as it appears on their documents.
create table if not exists public.application_people (
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  person_name text not null,
  email text,
  phone text,
  primary key (applicant_id, person_name)
);

-- The PIN hashes live in their own table with no RLS policies at all, so
-- even logged-in landlords can never read them - only the service role can.
create table if not exists public.applicant_credentials (
  applicant_id uuid primary key references public.applicants (id) on delete cascade,
  pin_hash text not null
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  name text not null,
  file_path text not null,
  mime_type text not null,
  -- Category the AI assigned on upload ("Pay stub", "Bank statement", ...).
  -- Null when the OpenAI key is not configured or classification failed.
  doc_type text,
  -- Who on the application this document belongs to. Null means the
  -- account holder (main applicant); otherwise a household member's
  -- name ("spouse", "mother", ...) as typed by the account holder.
  person_name text,
  -- How that person is on the application: 'resident' (will live in the
  -- home) or 'supporter' (guarantor / co-signer). Null for the main
  -- applicant's own documents.
  person_role text
    check (person_role in ('resident', 'supporter') or person_role is null),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- Nobody talks to these tables from the browser: applicants sign in with
-- name + PIN and the landlord views without an account, so every read
-- and write goes through the app server with the service role key.
-- RLS is enabled with NO policies - anon and authenticated see nothing.
-- ============================================================

alter table public.applicants enable row level security;
alter table public.applicant_credentials enable row level security;
alter table public.documents enable row level security;
alter table public.application_people enable row level security;

-- ============================================================
-- Storage: private bucket for the document files.
-- Uploads and reads all go through the app server (service role +
-- short-lived signed URLs), so no storage policies are needed.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
