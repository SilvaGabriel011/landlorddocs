# LandlordDocs

A small web app for sharing your rental application documents (financial
statements, pay stubs, references, etc.) with landlords.

How it works:

1. **You** sign in, upload your documents (PDF, PNG, or JPEG) and give each
   one a name.
2. You can **invite other people** on your application (a partner, roommate,
   guarantor…) to upload documents through a link, without an account. You
   decide which documents to request from each person — the name and the
   accepted file type (PDF, image, or either) of every one.
3. You create a **share link** for each landlord and decide **how long the
   link stays valid** (1, 3, 7, or 30 days — or any custom date and time).
   A link can include documents from everyone on the application.
4. The **landlord** opens the link — no account needed — and sees how many
   people are on the application and each person's documents. Clicking a
   name opens the PDF or image, with a download button.
5. The **Activity** page shows you what the landlord did: when they opened
   the link and which documents they viewed, downloaded, or printed.
   (Printing is only detected when done in the browser — printing a file
   after downloading it happens outside the app and cannot be seen.)
6. When the link expires (or you delete it), the landlord immediately loses
   access. The files themselves live in a private Supabase Storage bucket
   and are only ever served through short-lived signed URLs.

Built with [Next.js](https://nextjs.org) (App Router) and
[Supabase](https://supabase.com) (auth, Postgres, storage). Ready to deploy
on [Vercel](https://vercel.com).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates
   the tables, the security policies, and the private `documents` storage
   bucket.

   > Already ran an older version of `schema.sql`? Run
   > [`supabase/upgrade-invites-activity.sql`](supabase/upgrade-invites-activity.sql)
   > instead — it only adds the invite and activity tables.
3. Go to **Project Settings → API** and note down:
   - the **Project URL**
   - the **anon public** key
   - the **service_role** key (keep this one secret!)

## 2. Run locally

```bash
cp .env.example .env.local   # then fill in the three values from step 1.3
npm install
npm run dev
```

Open http://localhost:3000, create your account on the login page, and
start uploading.

> Tip: after you have created your own account, you can turn off new
> sign-ups in Supabase (**Authentication → Sign In / Up → disable
> "Allow new users to sign up"**) so nobody else can register on your app.
> Sign-ups only see their own data either way, but disabling keeps things
> tidy.

## 3. Deploy to Vercel

1. Push this repository to GitHub and import it in
   [vercel.com/new](https://vercel.com/new) (framework preset:
   **Next.js** — detected automatically).
2. In the Vercel project settings, add the same three environment
   variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy. Your share links will look like
   `https://your-app.vercel.app/share/<token>`.

## Notes on security

- All database tables use row level security: a logged-in user can only
  see and manage their own documents and links.
- The storage bucket is private. Landlords never get a permanent file URL —
  the app checks the share token and its expiration on every request, then
  redirects to a signed URL that is valid for 5 minutes.
- The `SUPABASE_SERVICE_ROLE_KEY` is only used in server code (never
  shipped to the browser) to resolve share tokens for landlords, who
  don't have accounts.
