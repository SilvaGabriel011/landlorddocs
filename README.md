# RentFolio

A small web app where people applying to rent upload their application
documents (pay stubs, bank statements, references…) and the landlord
reviews everything in one place.

How it works:

1. An **applicant** (someone who wants to rent) creates an account with
   their **name, email, and a 4-digit PIN** of their choice. Next time,
   they sign back in with just **name + PIN**.
2. They upload their documents — PDF, PNG, or JPEG, **several at once**.
   With an OpenAI API key configured, the default "Automatic" mode lets
   them **mix everyone's files in one upload**: the AI reads each
   document, gives it a clean title and category ("Pay stub", "Bank
   statement"…), and **files it under the right person** — the applicant
   themselves, someone moving in with them, or a supporter (guarantor /
   co-signer), which it flags when a document makes it clear. Each batch
   can also be assigned to a person manually.
3. The **landlord** needs **no account**: they open the app, tap
   "I'm the landlord", and see every application — alone or with its
   people — each with a per-person summary
   (`Gabriel: Pay stub × 2 · Ana (moving in): ID document × 1`).
   Optionally, set `LANDLORD_CODE` so the landlord types a code once.
4. Opening an application shows the documents grouped by person — each
   person's line shows their **email (as a mailto link)** and **phone
   (with a copy button)** when the applicant filled them in — and opening
   a document gives **Print** and **Download** buttons.
5. Applicants can also record the **property's condition before moving
   in** ("Inspections prior living"): they upload **photos and videos**
   of the house, the AI labels each photo with the **room it shows**
   ("Kitchen", "Bathroom"…), and for videos they pick the room
   themselves. The landlord sees the whole gallery, grouped by
   applicant and room, from a dedicated entry in the dashboard.
   > Note for Vercel deploys: serverless request bodies are capped
   > around 4.5 MB, so large video uploads need self-hosting (or a
   > future direct-to-storage upload).
6. Files live in a private Supabase Storage bucket and are only served
   through short-lived signed URLs — there are no public file links.

Built with [Next.js](https://nextjs.org) (App Router) and
[Supabase](https://supabase.com) (auth, Postgres, storage). Ready to deploy
on [Vercel](https://vercel.com).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates
   the tables, the security policies, and the private `documents` storage
   bucket.

   > Coming from the old share-link version of this app? Run
   > [`supabase/upgrade-tenant-login.sql`](supabase/upgrade-tenant-login.sql)
   > instead — note that it deletes the old model's data (documents, share
   > links, invites, activity).
   >
   > Already ran the login-model schema before household members existed?
   > Just run
   > [`supabase/upgrade-household-members.sql`](supabase/upgrade-household-members.sql)
   > — it only adds a column, nothing is deleted.
   >
   > Database created before per-person contact info existed? Also run
   > [`supabase/upgrade-people-contacts.sql`](supabase/upgrade-people-contacts.sql)
   > — additive only.
   >
   > Database created before inspection media existed? Also run
   > [`supabase/upgrade-inspections.sql`](supabase/upgrade-inspections.sql)
   > — additive only.
3. Go to **Project Settings → API** and note down:
   - the **Project URL**
   - the **anon public** key
   - the **service_role** key (keep this one secret!)

## 2. (Optional) Get an OpenAI API key

For automatic document categorization, create an API key at
[platform.openai.com](https://platform.openai.com/api-keys). Without it the
app still works — documents are simply listed without categories.

The model defaults to `gpt-5-mini` (cheap and good enough for
classification). Set `OPENAI_MODEL` to any other vision-capable model if
you prefer.

## 3. Run locally

```bash
cp .env.example .env.local   # then fill in the values (see the comments)
npm install
npm run dev
```

Open http://localhost:3000:

- **Landlord:** tap "I'm the landlord" — no account needed. If you set
  `LANDLORD_CODE`, you'll be asked for it once.
- **Applicants:** go to "I'm applying to rent", register with name +
  email + a 4-digit PIN, and upload documents.

> Strongly recommended for production: set `LANDLORD_CODE`. Without it,
> anyone who has the app's URL can open the landlord view and see every
> uploaded document.

## 4. Deploy to Vercel

1. Push this repository to GitHub and import it in
   [vercel.com/new](https://vercel.com/new) (framework preset:
   **Next.js** — detected automatically).
2. In the Vercel project settings, add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional, for auto-categorization)
   - `LANDLORD_CODE` (optional but strongly recommended — the code the
     landlord types once to open the dashboard)
   - `SESSION_SECRET` (optional but recommended — any long random string)
3. Deploy, and share the app URL with your applicants.

(There's a fill-in template for all of these in
[`vercel.env.example`](vercel.env.example) — copy it to
`.env.vercel.local`, fill it, and paste the whole thing into Vercel's
env-vars page in one go.)

## Notes on security

- Nobody talks to the database from the browser: row level security is
  enabled with no policies, and every read and write goes through the app
  server using the service role key.
- The landlord has no account. With `LANDLORD_CODE` set, the dashboard
  asks for the code once and remembers it in a signed cookie; without it,
  the dashboard is open to anyone with the URL.
- Applicants have no Supabase account either: the app server verifies
  their name + PIN (stored as a scrypt hash) and gives them an
  HMAC-signed, HTTP-only session cookie.
- A 4-digit PIN and a shared landlord code are convenience-grade
  security: sign-in attempts are throttled, but don't use this app for
  documents that would be catastrophic to leak — it's designed for the
  practical case of a rental application, not for secrets.
- The storage bucket is private. Files are only ever served through
  signed URLs valid for 5 minutes, after the server has checked who is
  asking.
- The `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are only used in
  server code and never shipped to the browser.
