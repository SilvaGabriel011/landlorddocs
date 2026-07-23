-- Adds pre-move-in inspection media to RentFolio: applicants upload
-- photos and videos of the property's condition before moving in.
-- Photos are labeled with the room they show by the AI (when the
-- OpenAI key is configured); videos are labeled manually at upload.
-- Run this in the Supabase SQL Editor if your database was created
-- before this feature. Additive only; safe to run more than once.

create table if not exists public.inspection_media (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  -- Display name: the AI's caption for photos ("Kitchen — bench and
  -- sink"), or the original filename as fallback / for videos.
  name text not null,
  -- Room/part of the house ("Kitchen", "Bathroom", ...). Values come
  -- from the ROOMS list in lib/rooms.ts. Null = unlabeled (AI off or
  -- failed, or the applicant skipped the dropdown for a video). No
  -- CHECK constraint on purpose: the taxonomy lives in code and may
  -- grow without another migration.
  room text,
  file_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

-- Same posture as every other table: RLS on, zero policies — only the
-- service role (the app server) can touch it.
alter table public.inspection_media enable row level security;
