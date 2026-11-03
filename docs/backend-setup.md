# Connected backend

Project: [Index](https://supabase.com/dashboard/project/wvaouepnnlqlxftrvjpf), in the selected c28aa1-rgb organization, US East (Northern Virginia).

API URL: `https://wvaouepnnlqlxftrvjpf.supabase.co`.

The project URL and publishable key are configured in the ignored `.env.local` file. The frontend has no service-role key or Google client secret.

Applied `create_study_sets_and_progress` and `add_private_card_stars` to the hosted database. App tables have row-level security and explicit API grants. Live transaction checks verified private-set visibility, per-user progress and star isolation, rejection of cross-owner edits and owner spoofing, anonymous access to shared sets, and rejection of stars for nonexistent cards. All temporary records were rolled back. The current security advisor has no table-policy findings; it notes disabled leaked-password protection, while password sign-in is disabled for this Google-only app.

Authentication settings:

- Email sign-up/sign-in is disabled. Google is the only planned sign-in provider; no local or password entry is offered.
- Production Site URL is `https://c28aa1-rgb.github.io/index-study/`.
- Allowed redirects are exactly `https://c28aa1-rgb.github.io/index-study/`, `http://127.0.0.1:4173/`, and `http://127.0.0.1:5173/`.
- Google is enabled using the OAuth client credentials supplied through the Supabase dashboard. The public Auth settings endpoint confirms Google enabled and email disabled. A live browser check reached Google’s account chooser; completing the user’s consent and callback remains a user sign-in step.

The Google client must retain callback URL `https://wvaouepnnlqlxftrvjpf.supabase.co/auth/v1/callback`. Client credentials are managed in [Supabase’s Google provider settings](https://supabase.com/dashboard/project/wvaouepnnlqlxftrvjpf/auth/providers?provider=Google). Keep the secret in Supabase. The app checks provider availability and enables the Google button when the provider is available. Google profile names are used automatically.

Repository: [c28aa1-rgb/index-study](https://github.com/c28aa1-rgb/index-study). GitHub Pages deploys the `main` branch through the Deploy Index workflow. The Supabase URL and publishable key are repository Actions variables; private credentials are excluded from Git.

Firebase inspection confirmed this app has no Firebase configuration, SDK, or Firestore dependency. No Firebase project or Firestore rules were changed because the app uses Supabase for authentication and study data.
