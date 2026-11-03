# Connected backend

Project: [Dalton Index](https://supabase.com/dashboard/project/wvaouepnnlqlxftrvjpf), in the selected c28aa1-rgb organization, US East (Northern Virginia).

API URL: `https://wvaouepnnlqlxftrvjpf.supabase.co`.

The project URL and publishable key are configured in the ignored `.env.local` file. The frontend has no service-role key or Google client secret.

Applied `create_study_sets_and_progress` to the hosted database. Both app tables have row-level security and explicit API grants. Live transaction checks verified private-set visibility, per-user progress isolation, rejection of cross-owner edits and owner spoofing, and anonymous access to shared sets. All temporary records were rolled back. Supabase's security advisor reported no findings.

Authentication settings:

- Email sign-up/sign-in is disabled. Google is the only planned sign-in provider; no local or password entry is offered.
- Production Site URL is `https://c28aa1-rgb.github.io/dalton-index/`.
- Allowed redirects are exactly `https://c28aa1-rgb.github.io/dalton-index/`, `http://127.0.0.1:4173/`, and `http://127.0.0.1:5173/`.
- Google is enabled using the OAuth client credentials supplied through the Supabase dashboard. The public Auth settings endpoint confirms Google enabled and email disabled. A live browser check reached Google’s account chooser; completing the user’s consent and callback remains a user sign-in step.

The Google client must retain callback URL `https://wvaouepnnlqlxftrvjpf.supabase.co/auth/v1/callback`. Client credentials are managed in [Supabase’s Google provider settings](https://supabase.com/dashboard/project/wvaouepnnlqlxftrvjpf/auth/providers?provider=Google). Keep the secret in Supabase. The app checks provider availability and enables the Google button when the provider is available. Google profile names are used automatically.

Repository: [c28aa1-rgb/dalton-index](https://github.com/c28aa1-rgb/dalton-index). GitHub Pages deploys the `main` branch through the Deploy Dalton Index workflow. The Supabase URL and publishable key are repository Actions variables; private credentials are excluded from Git.

Firebase inspection confirmed this app has no Firebase configuration, SDK, or Firestore dependency. No Firebase project or Firestore rules were changed because the app uses Supabase for authentication and study data.
