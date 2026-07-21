-- LandlordDocs database schema.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  file_path text not null,
  mime_type text not null,
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

-- ============================================================
-- Row Level Security: owners can only touch their own rows.
-- Landlords never query these tables directly; the app server
-- resolves share tokens with the service role key.
-- ============================================================

alter table public.documents enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_documents enable row level security;

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

-- ============================================================
-- Storage: private bucket for the document files.
-- Files are stored under <user id>/<file name> so the folder
-- name can be used in the policies below.
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
