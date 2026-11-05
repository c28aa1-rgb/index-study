# Index in ChatGPT on the web

The active connection is **Index Study Web**, a private ChatGPT Sites plugin. It exposes a connection-status tool and the four existing Index study-set tools: find, read, create a private set, and add/remove cards. ChatGPT generates the cards from notes in the conversation; Index saves them. No AI API key is needed.

## Hosted pieces

- Index app and consent UI: https://c28aa1-rgb.github.io/index-study/
- Private account-linking Site: https://index-study-web.wiseonyx1.chatgpt.site
- Site project: `appgprj_6aecbbf6fcf88191ba43f0590cb1e896`
- Canonical Site-created plugin: `plugin_asdk_app_sites_051e9801d6088191acff41be91c1c138`
- Site MCP: `https://index-study-web.wiseonyx1.chatgpt.site/mcp`
- Site source checkout: `integrations/index-chatgpt-web/`, tracked in the Site's separate source repository. Its `.openai/hosting.json` owns that Site identity; the parent GitHub Pages repository ignores this nested checkout.
- Existing Index capability server: `https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp`
- Supabase SQL: `supabase/connector.sql`

## User setup

1. Open the private connection Site in a browser. Continue with ChatGPT if asked.
2. Choose **Link Index account**, sign in with the existing Index Google account, then select **Allow connection** on the Index consent screen.
3. Return to the Site and confirm **Index account linked**.
4. In ChatGPT Plugins, open **Personal → Created by you → Index Study Web**. Install or connect if shown. Sites may install it automatically when publishing.
5. On ChatGPT web, switch to **Work**, start a new chat, type `@`, and select **Index Study Web**. Ask it to create a set from notes or update cards in an existing set.

The Site is owner-private. Personal Site-hosted plugins cannot currently be shared with other ChatGPT users. This setup is for the owning ChatGPT account; it is not a public, multi-user connector. Access to the Site, its plugin, and the Index account are separate permissions.

The old standalone private plugin (`plugins_6aeca7c3678c8191a0abb08bc370a2b5`) is retired. Its package source has been removed from this repository. Plugin Management reported that it was not installed when removal was requested; deleting a saved plugin definition from “Created by you” is separate from uninstalling it.

## Account and data boundaries

Sites authenticates the caller before forwarding requests and supplies a Site-scoped user ID. The Site's MCP tools require that identity and only use the encrypted Index credentials stored for that same Site user. No email-based account matching or Supabase service-role key is used.

Linking uses a dedicated public Supabase OAuth client, a fixed callback URL, authorization code flow with PKCE, one-use state bound to the Site user, and explicit Index consent. Browser mutation routes reject cross-origin requests. Tokens are encrypted with AES-GCM in the Site's D1 database; their key is a Sites runtime secret. Tokens never appear in browser JavaScript, MCP tool output, Git, or the hosting manifest. Refreshes use a per-user lease to prevent concurrent token rotation.

Every study operation still reaches the existing Index MCP server and narrow SQL capability. Those independently validate the signed Index user, OAuth client, resource audience, expiry, live OAuth session, current consent and Index grant, set ownership, card limits, revision, and idempotency key. OAuth is denied raw sets, study progress, stars, and grant-table access. New sets are private. Edits preserve untouched card IDs and require the exact current revision. The tools cannot delete whole sets or change their visibility or owner.

Disconnecting on the Site deletes its encrypted credentials before attempting to sign out the dedicated OAuth session. Disconnecting in Index revokes the grant that every backend call checks. Already running requests may finish; subsequent requests fail. A failure to sign out upstream does not restore deleted Site access.

## Server prerequisites

The existing Supabase project settings remain required and were configured before the Site was built:

- Authentication → Hooks: enabled Postgres Custom Access Token hook `public.index_connector_token_hook`.
- Authentication → OAuth Server: enabled, authorization path `/oauth-consent.html`, dynamic registration enabled.
- Site URL: `https://c28aa1-rgb.github.io/index-study/`.

The dedicated Index Study Web OAuth client allows only `https://index-study-web.wiseonyx1.chatgpt.site/oauth/callback`. The bridge requests `openid offline_access` and the existing Index MCP resource. Runtime environment names and rotation limitations are documented in the Site source README.

## Verification

The Site has eight focused tests for anonymous rejection, user isolation, token encryption, cross-origin form rejection, PKCE/state binding and replay, expired state, refresh coordination, local-first disconnect, and revoked upstream access. TypeScript and the production Sites build also pass. Sites publication provisions and discovers the canonical plugin.

A complete real-account verification requires the user to finish Index consent, then call the plugin from a fresh ChatGPT Work web conversation. Publication and mocked tests do not prove that final round trip.

The original backend tests remain under `tests/connector.test.ts`, `tests/connector-database.sql`, and `tests/e2e/connections.spec.ts`. The rollback SQL fixtures use synthetic users and sets only.
