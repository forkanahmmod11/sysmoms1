# Sysmobyte OMS

## New platform capabilities

- Admin-controlled public posts displayed in workspace dashboards.
- Email/password auth with email-confirmation enforcement plus Google OAuth.
- Master Admin user search and Team member search.
- User profiles with avatar/cover URL, bio, skills, certification links, posts, comments and reactions.
- Smooth route/slide transitions, smooth scrolling and skeleton loading.
- Master Admin Secrets management backed by Supabase Vault; secret values are never returned to the browser after save.

## Supabase setup

1. Apply all migrations in `supabase/migrations/`, including `20260907110000_social_posts_profiles_secrets.sql`.
2. In Supabase Auth, enable **Confirm email** for email/password signup and configure the production SMTP provider for reliable verification mail.
3. Enable the **Google** OAuth provider and add the app origin/callback URL shown by your Supabase project to the Google OAuth client configuration.
4. The browser only receives the publishable/anon key. Do not put a Supabase secret/service-role key in Vite environment variables.
5. The Secrets page uses Supabase Vault. The secret value is accepted by an authenticated RPC and stored encrypted; only name/description/timestamps are listed back to the UI.

The profile picture and cover fields currently accept image URLs. This keeps the feature functional without requiring a new Storage bucket; Supabase Storage can be wired later if file uploads are desired.
