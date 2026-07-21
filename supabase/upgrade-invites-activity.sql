-- Upgrade script: adds upload invites and landlord activity tracking.
-- Run this ONLY if you already ran an older schema.sql. For a fresh
-- Supabase project, run schema.sql instead (it already contains all of this).

-- Documents can now belong to an invited person (e.g. a partner or roommate).
alter table public.documents
  add column if not exists person_name text,
  add column if not exists invite_id uuid,
  add column if not exists requested_doc_id uuid;

-- Invites: the owner asks another person to upload specific documents.
create table if not exists public.upload_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  person_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_requested_documents (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.upload_invites (id) on delete cascade,
  name text not null,
  accepted_type text not null default 'any'
    check (accepted_type in ('pdf', 'image', 'any')),
  created_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_invite_id_fkey
    foreign key (invite_id) references public.upload_invites (id) on delete set null,
  add constraint documents_requested_doc_id_fkey
    foreign key (requested_doc_id) references public.invite_requested_documents (id) on delete set null;

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

alter table public.upload_invites enable row level security;
alter table public.invite_requested_documents enable row level security;
alter table public.share_activity enable row level security;

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
