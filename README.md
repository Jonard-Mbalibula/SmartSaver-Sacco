# SmartSaver Sacco

A full stack financial operations app built with Next.js, Vercel, and Supabase.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Run:

```sh
npm install
npm run dev
```

The app falls back to demo data if Supabase environment variables are missing,
so the UI can still be reviewed before connecting the database.
