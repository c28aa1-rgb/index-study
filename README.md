# Index

[Open the app](https://c28aa1-rgb.github.io/dalton-index/) · [Source on GitHub](https://github.com/c28aa1-rgb/dalton-index)

A study app built with React, TypeScript, Vite, Tailwind CSS, and Framer Motion.

Create and edit sets, reorder cards, import pasted notes or CSV/TXT/TSV files, and share sets. Study with flashcards, adaptive Learn rounds, written/multiple-choice/true-or-false tests, a timed Match game, and spaced review. Study progress persists between visits.

Star individual cards from a set, Flashcards, or Learn. Stars are private to each account and sync across devices. Flashcards and Learn can focus on starred cards. Learn supports study goals, initial familiarity, adaptive recall practice and saved history for each answer direction. Its scheduler approximates Quizlet’s publicly described behavior; see [Learn behavior](docs/learn-design.md) for its rules and limitations.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Supabase must be configured and its Google provider enabled to enter the app. Signing in creates an account for first-time Google users. Sets and progress sync to that account, and names come from the Google profile.

The first visit opens the Google-only sign-in screen. Email/password sign-in and local-browser entry are not offered. Explore contains only public sets shared by users, with no built-in starter decks.

## Supabase accounts and sync

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor. The schema enables row-level security: only owners can change sets; only owners can read private sets; each account can access only its own progress.
2. Copy `.env.example` to `.env.local` and fill in the project URL and public anon/publishable key. Never use a service-role key in a frontend build.
3. Disable the Email auth provider and configure Google as described below. Set the Supabase Auth Site URL to the deployed app URL, including the repository path and trailing slash, such as `https://yourname.github.io/index/`. Add the local development URL if needed.
4. Restart Vite and choose **Continue with Google**. No separate password or name form is required.

Cloud share links refer to the live set; privacy changes and deletions apply to those links. Public sets appear in Explore; unlisted sets are available to anyone who has their URL. Unlisted is not access-controlled membership.

Progress is cached per account in the browser and synced after a short delay. If a sync fails, the app shows a notice; the local copy remains available in that browser. Keep the tab open briefly after answering to let cloud sync finish. Tests and Match timing do not require a server.

Auth setup follows [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls). Reduced motion follows [MotionConfig](https://motion.dev/docs/react-motion-config).

### Google account creation and sign-in

1. In Google Auth Platform, create a Web application OAuth client. Add your app origin under Authorized JavaScript origins, and add the callback URL shown in Supabase’s Google provider settings under Authorized redirect URIs. That callback normally looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase Authentication → Sign In / Providers → Google, enable Google and enter the Google client ID and client secret. Keep the client secret in Supabase; never put it in a `VITE_` variable or source code.
3. Add the exact app base URL to Supabase’s redirect allowlist, including its repository subdirectory and trailing slash. Local preview uses `http://127.0.0.1:4173/`; development uses `http://127.0.0.1:5173/`.
4. Configure the public Supabase URL/key above and rebuild. **Continue with Google** uses the same flow for returning users and new accounts. Supabase must allow new-user sign-ups for first-time Google users.

Google OAuth uses PKCE. Supabase exchanges the callback code before the app opens the library. The original set or study route is restored after sign-in. Google setup follows the [official Supabase guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Deploy to GitHub Pages

1. Push this project to a GitHub repository with a `main` branch.
2. In Settings → Pages, select **GitHub Actions** as the build source.
3. For cloud mode, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions **variables**. Both are required for Google sign-in.
4. Push to `main` or run the Deploy Index workflow manually. It runs unit tests, browser tests, and the production build before deploying.

Hash routing and relative build paths support repository subdirectories and refreshes without a server rewrite. No repository or live Supabase project is provisioned by the source code.

The workflow follows [GitHub’s custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

To use installed Chrome on macOS instead of downloading Chromium:

```sh
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

Browser tests run desktop and mobile flows for import/edit, flashcards/undo, Learn, test scoring, Match, spaced review, sharing between Google accounts, Google-only PKCE entry, modal keyboard focus, and reduced motion. Browser tests use a separate build and mocked Supabase endpoints; they do not contact real user accounts. Unit tests cover answer grading, CSV quoting, share validation, and review scheduling. Real Google sign-in and production deployment still require a configured OAuth client and repository. Live database policies were verified separately; see `docs/backend-setup.md`.

Design references: `docs/design-system.md`, `docs/design-philosophy.md`, and `docs/index-desk.png`.
