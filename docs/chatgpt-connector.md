# Index in ChatGPT

The connector exposes four authenticated tools: find your sets, read a set, create a private set, and add/remove cards. ChatGPT generates card content from notes supplied in the conversation; Index saves the resulting term/definition pairs. No AI API key is needed in Index.

## Hosted pieces

- App and consent UI: https://c28aa1-rgb.github.io/index-study/
- MCP server (stateless Streamable HTTP): https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp
- Protected resource metadata: the MCP URL plus `/.well-known/oauth-protected-resource`
- Authorization provider: the existing project's Supabase Auth OAuth 2.1 server
- SQL: `supabase/connector.sql`, applied after `supabase/schema.sql`
- Edge function: `supabase/functions/index-mcp/`
- Private plugin: https://chatgpt.com/plugins/plugins_6aeca7c3678c8191a0abb08bc370a2b5
- Portable private plugin source: `plugin/index-study/`

## One-time project setup

These settings must be enabled by a signed-in project administrator. The code intentionally rejects access until token audience, live provider consent, a live OAuth session, and Index's grant all match.

1. In Supabase **Authentication → Hooks**, add the **Custom Access Token** Postgres hook `public.index_connector_token_hook`. This adds the MCP resource to OAuth access-token audiences while leaving ordinary Google sign-ins unchanged. Supabase has the required execute grant in `connector.sql`.
2. In **Authentication → OAuth Server**, enable the OAuth server, set **Authorization Path** to `/oauth-consent.html`, and enable **Dynamic Client Registration**. The site's URL remains `https://c28aa1-rgb.github.io/index-study/`. Supabase joins this path to the Site URL; the static page safely bridges `authorization_id` to the app's hash router.
3. Verify the OAuth discovery URL returns JSON: `https://wvaouepnnlqlxftrvjpf.supabase.co/.well-known/oauth-authorization-server/auth/v1`. Existing ES256 signing keys support OpenID Connect.
4. Install the Index private plugin or add the MCP server URL in ChatGPT Plugins → Add custom MCP server. Choose **OAuth**, dynamic client registration, and scope `openid` if the connection asks. Do not paste API keys or browser tokens into ChatGPT.
5. Connect with Google. Review the real client name and callback address on Index's consent screen, then select **Allow connection** yourself. No automatic consent is performed by the app.
6. Ask ChatGPT to make a set from notes. Open its returned Index link, then test adding/removing cards from that disposable set. Disconnect under **Index → Connections** and verify the old connection stops working.

Dynamic registration lets clients register but grants no user data access. Each user still needs to sign in and explicitly approve. For a tighter deployment, register the exact ChatGPT client and callback shown by ChatGPT and disable dynamic registration afterward; update the plugin's OAuth client mode accordingly.

## Data and permission boundaries

OAuth access is denied on raw sets, progress, stars, and grant tables. A fixed-operation RPC lives behind an unexposed private schema. Its intentionally privileged implementation checks `auth.uid()`, signed `client_id`, resource audience, current `auth.sessions`, unrevoked `auth.oauth_consents`, and a user-managed Index grant on every call. It only selects/changes rows owned by that user. The Edge Function uses the project's public anon key and the user's OAuth token, never a service-role key.

The RPC cannot change visibility, owner, title, or description of an existing set, delete whole sets, read someone else's sets (including public ones), or access study history. Create always uses private visibility. Card IDs and attribution on unchanged cards are preserved. Card removal must leave at least two cards.

Every write requires a fresh UUID `request_id`. Identical retries return the saved result without changing data twice; reuse with different arguments is rejected. Edits require the exact `updated_at` revision and lock the row. The website also saves existing sets with a revision predicate, so a stale editor cannot overwrite changes made by ChatGPT. Operation receipts are private and are removed when their set, OAuth client, or user is deleted.

Disconnect removes Index's permission first (immediate effect on existing tokens), then revokes the provider grant. A provider revocation error is surfaced separately. Tokens are verified against the provider's public signing keys and checked for issuer, expiry, audience, OAuth client and session. Do not add service keys to plugin files or to the client app.

## Verification

- `npm test`: transport discovery, authentication rejection, argument validation, size limits and safe error messages.
- `tests/connector-database.sql`: transaction-only synthetic fixtures proving isolation, creation, precise edits, retained cards, pagination, retries, revision conflicts, cardinality checks, disconnection and normal Google-session compatibility. Run inside BEGIN/ROLLBACK after the connector SQL in a development database, or in a single rollback transaction as part of controlled verification. Never use real account data.
- `npm run test:e2e`: consent is explicit, denial grants nothing, broken requests fail closed, disconnect ordering, and existing study flows on desktop/mobile.
- The final real ChatGPT OAuth round trip requires the project settings above and user consent. Unit, mocked-browser, and rollback SQL checks do not replace that final connection test.

## Hosting note

GitHub Pages hosts the frontend only. The Supabase Edge Function hosts the MCP server and is deployed with gateway `verify_jwt=false`: public discovery/initialization must be reachable, while its own handler verifies every tool call and the database checks live authorization again. Turning off gateway JWT verification does not make tools anonymous.
