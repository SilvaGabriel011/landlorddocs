# RentFolio

A small web app where people applying to rent upload their application
documents (pay stubs, bank statements, references…) and the landlord
reviews everything in one place.

How it works:

1. An **applicant** (someone who wants to rent) creates an account with
   their **name, email, and a 4-digit PIN** of their choice. Next time,
   they sign back in with just **name + PIN**.
2. They upload their documents — PDF, PNG, or JPEG, **several at once** —
   and can file each batch under a **household member** (spouse, guarantor,
   mother…), keeping everyone on the application in one account. If an
   OpenAI API key is configured, each document is read by the AI and
   **categorized automatically** ("Pay stub", "Bank statement", "ID
   document"…) with a clean title.
3. The **landlord** signs in with email + password and sees the **list of
   applicants**, each with a per-person summary of what they sent
   (`Gabriel: Pay stub × 2 · Ana: Bank statement × 1`).
4. Clicking an applicant shows their documents grouped by person, with
   **view** and **download** buttons.
5. Files live in a private Supabase Storage bucket and are only served
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

- **Landlord:** go to "I'm the landlord", create your account (email +
  password), and you'll land on the applicant list.
- **Applicants:** go to "I'm applying to rent", register with name +
  email + a 4-digit PIN, and upload documents.

> Tip: after you have created your own landlord account, turn off new
> sign-ups in Supabase (**Authentication → Sign In / Up → disable
> "Allow new users to sign up"**) so nobody else can register as a
> landlord. Applicant accounts are separate and stay open.

## 4. Deploy to Vercel

1. Push this repository to GitHub and import it in
   [vercel.com/new](https://vercel.com/new) (framework preset:
   **Next.js** — detected automatically).
2. In the Vercel project settings, add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional, for auto-categorization)
   - `SESSION_SECRET` (optional but recommended — any long random string)
3. Deploy, and share the app URL with your applicants.

## Notes on security

- Landlords are Supabase auth users. Row level security lets them **read**
  applicants and documents, nothing more.
- Applicants have no Supabase account: the app server verifies their
  name + PIN (stored as a scrypt hash in a service-role-only table) and
  gives them an HMAC-signed, HTTP-only session cookie. All their reads and
  writes go through server routes.
- A 4-digit PIN is convenience-grade security: sign-in attempts are
  throttled, but don't use this app for documents that would be
  catastrophic to leak — it's designed for the practical case of a rental
  application, not for secrets.
- The storage bucket is private. Files are only ever served through
  signed URLs valid for 5 minutes, after the server has checked who is
  asking.
- The `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are only used in
  server code and never shipped to the browser.
