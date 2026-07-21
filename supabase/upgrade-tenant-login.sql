-- Migrates an existing LandlordDocs install from the old share-link model
-- (tenant owns the account, landlord opens links) to the new login model
-- (landlord owns the account, applicants sign in with name + 4-digit PIN).
--
-- WARNING: this DELETES all existing documents, share links, invites and
-- activity rows - the old data belongs to the old model and cannot be
-- carried over. Files already in the storage bucket are not deleted
-- automatically; remove them from Storage -> documents if you want a
-- clean slate.

-- Old tables.
drop table if exists public.share_activity;
drop table if exists public.share_link_documents;
drop table if exists public.share_links;
drop table if exists public.documents;
drop table if exists public.invite_requested_documents;
drop table if exists public.upload_invites;

-- Old storage policies (uploads now go through the app server).
drop policy if exists "Owners upload their files" on storage.objects;
drop policy if exists "Owners read their files" on storage.objects;
drop policy if exists "Owners delete their files" on storage.objects;

-- New tables (same definitions as schema.sql).
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

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
  doc_type text,
  created_at timestamptz not null default now()
);

alter table public.applicants enable row level security;
alter table public.applicant_credentials enable row level security;
alter table public.documents enable row level security;

create policy "Landlords read applicants"
  on public.applicants for select to authenticated
  using (true);

create policy "Landlords read documents"
  on public.documents for select to authenticated
  using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
