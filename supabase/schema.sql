-- LandlordDocs database schema (full install).
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- If you already ran an OLDER version of this file, run
-- upgrade-invites-activity.sql instead of running this again.

-- ============================================================
-- Tables
-- ============================================================

-- Invites: the owner asks another person (partner, roommate, ...) to
-- upload specific documents through a link, without an account.
create table if not exists public.upload_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  person_name text not null,
  created_at timestamptz not null default now()
);

-- The list of documents the owner wants from an invited person.
-- Each request has its own name and accepted file type.
create table if not exists public.invite_requested_documents (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.upload_invites (id) on delete cascade,
  name text not null,
  accepted_type text not null default 'any'
    check (accepted_type in ('pdf', 'image', 'any')),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  file_path text not null,
  mime_type text not null,
  -- Who this document belongs to. Null means the account owner;
  -- otherwise the name of the invited person who uploaded it.
  person_name text,
  invite_id uuid references public.upload_invites (id) on delete set null,
  requested_doc_id uuid references public.invite_requested_documents (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  label text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.share_link_documents (
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  primary key (share_link_id, document_id)
);

-- Activity log: what the landlord did with a share link.
create table if not exists public.share_activity (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  document_name text,
  action text not null
    check (action in ('link_opened', 'viewed', 'downloaded', 'printed')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security: owners can only touch their own rows.
-- Landlords and invited people never query these tables directly;
-- the app server resolves their tokens with the service role key.
-- ============================================================

alter table public.documents enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_documents enable row level security;
alter table public.upload_invites enable row level security;
alter table public.invite_requested_documents enable row level security;
alter table public.share_activity enable row level security;

create policy "Owners manage their documents"
  on public.documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their share links"
  on public.share_links for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their share link documents"
  on public.share_link_documents for all
  using (
    exists (
      select 1 from public.share_links sl
      where sl.id = share_link_id and sl.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.share_links sl
      where sl.id = share_link_id and sl.owner_id = auth.uid()
    )
  );

create policy "Owners manage their invites"
  on public.upload_invites for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their requested documents"
  on public.invite_requested_documents for all
  using (
    exists (
      select 1 from public.upload_invites ui
      where ui.id = invite_id and ui.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.upload_invites ui
      where ui.id = invite_id and ui.owner_id = auth.uid()
    )
  );

-- Owners can read the activity of their links. Rows are only inserted by
-- the app server (service role), never by browsers directly.
create policy "Owners read their share activity"
  on public.share_activity for select
  using (
    exists (
      select 1 from public.share_links sl
      where sl.id = share_link_id and sl.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Storage: private bucket for the document files.
-- Files are stored under <user id>/... so the folder name can be
-- used in the policies below. Invited people upload through the
-- app server, which uses signed upload URLs.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Owners upload their files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owners read their files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owners delete their files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
