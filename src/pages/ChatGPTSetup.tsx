import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Page } from '../components/ui'

const serverUrl = 'https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp'
const scopes = 'openid\noffline_access'
const screenshot = (file: string) => `${import.meta.env.BASE_URL}guides/chatgpt/${file}`
const external = 'font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink'

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const classes = 'w-full min-w-0 rounded-lg border border-rule bg-paper px-3 py-3 font-mono text-xs leading-relaxed text-ink'
  return <div className="my-5">
    <label className="block text-sm font-semibold">
      {label}
      {multiline ? <textarea className={`${classes} mt-2 resize-none`} rows={2} readOnly value={value} onFocus={e => e.target.select()} /> : <input className={`${classes} mt-2`} readOnly value={value} onFocus={e => e.target.select()} />}
    </label>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <Button tone="paper" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setFailed(false) }
        catch { setFailed(true) }
      }}>{copied ? 'Copied' : `Copy ${label.toLowerCase()}`}</Button>
      <span role="status" className="text-xs text-ink-3">{failed ? 'Select the text above and copy it manually.' : copied ? 'Ready to paste into ChatGPT.' : ''}</span>
    </div>
  </div>
}

function Shot({ file, alt, caption }: { file: string; alt: string; caption: string }) {
  return <figure className="min-w-0 rounded-xl border border-rule bg-paper p-3">
    <a href={screenshot(file)} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-margin" aria-label={`Open full screenshot: ${alt}`}>
      <img src={screenshot(file)} alt={alt} width={633} height={977} loading="lazy" decoding="async" className="mx-auto max-h-[520px] w-full rounded-lg bg-black object-contain" />
    </a>
    <figcaption className="mt-3 text-xs leading-relaxed text-ink-3">{caption} <a className="font-semibold underline underline-offset-4" href={screenshot(file)} target="_blank" rel="noopener noreferrer">Open full screenshot</a></figcaption>
  </figure>
}

function Step({ number, title, children, image }: { number: number; title: string; children: ReactNode; image?: ReactNode }) {
  return <section id={`step-${number}`} className="scroll-mt-24 border-t border-rule py-9 sm:py-12" aria-labelledby={`step-title-${number}`}>
    <div className={`grid items-start gap-6 ${image ? 'md:grid-cols-[1fr_0.95fr] md:gap-10' : ''}`}>
      <div>
        <h2 id={`step-title-${number}`} className="flex items-start gap-3 font-display text-2xl font-bold leading-tight"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-sm text-white">{number}</span>{title}</h2>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      </div>
      {image}
    </div>
  </section>
}

export default function ChatGPTSetup() {
  return <Page className="pt-10 sm:pt-14">
    <h1 className="desk-heading max-w-3xl">Connect Index<br className="hidden sm:block" /> to ChatGPT.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">A step-by-step guide to adding Index as your own custom MCP connection in ChatGPT on the web.</p>
    <aside className="my-8 rounded-xl border border-margin/30 border-l-4 border-l-margin bg-paper px-5 py-5 sm:px-6" aria-labelledby="eligibility-title">
      <h2 id="eligibility-title" className="font-display text-xl font-bold">Check your ChatGPT access first</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">Your ChatGPT account or workspace must allow <strong>custom MCP servers</strong> and <strong>write actions</strong> to create or edit sets. OpenAI currently documents full support for Business, Enterprise, and Edu. Plan, role, and workspace restrictions still apply—even if the Add menu is visible.</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">If <strong>Add custom MCP server</strong> is missing or blocked, stop here and check with your workspace admin or <a className={external} href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">OpenAI’s current availability guide</a>. Changing Index settings cannot enable a missing ChatGPT feature.</p>
    </aside>
    <p className="mb-8 max-w-3xl text-xs leading-relaxed text-ink-3">Real ChatGPT web screenshots captured November 6, 2026, with chat history hidden. The screenshots cover the setup form and OAuth discovery. Completing the full sign-in and saving a set still needs to be verified in your account. ChatGPT’s layout may change.</p>

    <Step number={1} title="Open Plugins in ChatGPT web" image={<Shot file="01-plugins.jpg" alt="ChatGPT web Plugins page with Add in the top right and the chat sidebar hidden" caption="Look for Add in the top-right corner of the Plugins page." />}>
      <p>Open <a className={external} href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">chatgpt.com/plugins</a> in a browser tab. Sign in to the ChatGPT account where you want to use Index.</p>
      <p>If you use more than one workspace, choose the workspace that allows custom MCP connections before continuing.</p>
      <p>You should see the heading <strong>Plugins</strong> and an <strong>Add</strong> button near the top right. In some layouts, this appears as a plus button.</p>
    </Step>

    <Step number={2} title="Choose Add custom MCP server" image={<Shot file="02-add-menu.jpg" alt="ChatGPT Add menu showing Create plugin, Upload plugin archive, and Add custom MCP server" caption="Choose Add custom MCP server, the bottom option in this menu." />}>
      <ol className="list-decimal space-y-3 pl-5"><li>Click <strong>Add</strong>.</li><li>Click <strong>Add custom MCP server</strong>.</li></ol>
      <p>This opens the connection form shown in the next step. You are adding a connection to the Index server directly; you do not need the old private Index plugin listing or a plugin ZIP file.</p>
    </Step>

    <Step number={3} title="Enter the Index connection details" image={<Shot file="03-connection-form.jpg" alt="Real ChatGPT custom MCP form filled with Index Study, the Index server URL, and OAuth authentication" caption="The actual form filled with the Index values. The risk checkbox is intentionally unchecked in this example." />}>
      <dl className="divide-y divide-rule rounded-lg border border-rule bg-paper px-4">
        <div className="py-3"><dt className="font-semibold text-ink">Name</dt><dd>Index Study</dd></div>
        <div className="py-3"><dt className="font-semibold text-ink">Description</dt><dd>Optional. For example: “Create private study sets from notes and add or remove cards in your Index sets.”</dd></div>
        <div className="py-3"><dt className="font-semibold text-ink">Connection</dt><dd>Select <strong>Server URL</strong>.</dd></div>
        <div className="py-3"><dt className="font-semibold text-ink">Authentication</dt><dd>Select <strong>OAuth</strong>.</dd></div>
      </dl>
      <CopyField label="Server URL" value={serverUrl} />
      <p>Paste the entire URL into <strong>Server URL</strong>, with no spaces before or after it. The optional icon can be left empty.</p>
    </Step>

    <Step number={4} title="Check the OAuth registration method" image={<Shot file="04-oauth-registration.jpg" alt="ChatGPT advanced OAuth settings with Dynamic Client Registration DCR selected" caption="DCR was automatically discovered from the real Index server. The CIMD-unavailable message is expected when using DCR." />}>
      <ol className="list-decimal space-y-3 pl-5"><li>Open <strong>Advanced OAuth settings</strong>.</li><li>Wait for <strong>Discovering OAuth settings…</strong> to finish.</li><li>Find <strong>Registration method</strong>. It should be <strong>Dynamic Client Registration (DCR)</strong>.</li></ol>
      <p>Index advertises DCR, and ChatGPT selected it automatically in this capture. If needed, select it from the registration menu.</p>
      <p>With DCR, you do not need to enter an OAuth client ID, client secret, or API key. Leave the discovered authorization, token, and registration endpoint values as they are.</p>
      <p>The message <strong>“CIMD is unavailable”</strong> is expected here. DCR is the method this setup uses.</p>
    </Step>

    <Step number={5} title="Set the scopes" image={<Shot file="05-scopes.jpg" alt="ChatGPT OAuth scope settings with openid selected and openid plus offline_access on separate lines under Base scopes" caption="Keep openid selected under Default scopes. Enter these two lines under Base scopes." />}>
      <p>Scroll inside the form to the <strong>Scopes</strong> section. Keep <strong>openid</strong> checked under <strong>Default scopes</strong>.</p>
      <p>In <strong>Base scopes</strong>, paste these two lines, one scope per line:</p>
      <CopyField label="Base scopes" value={scopes} multiline />
      <p><strong>openid</strong> supports account sign-in. <strong>offline_access</strong> requests a refresh token so you do not have to reconnect whenever the short-lived access token expires.</p>
    </Step>

    <Step number={6} title="Create, install, and connect your account">
      <ol className="max-w-3xl list-decimal space-y-4 pl-5">
        <li>Read ChatGPT’s custom-server warning. If you want to connect, select <strong>I understand and want to continue</strong>, then click <strong>Create as a plugin</strong>.</li>
        <li>Review the discovered Index tools. They should let you <strong>find sets</strong>, <strong>read a set</strong>, <strong>create a private set</strong>, and <strong>add or remove cards</strong>.</li>
        <li>Install the resulting plugin if prompted. Creating a plugin and installing it are separate steps. Open the new <strong>Index Study</strong> entry and choose <strong>Install</strong> or its install plus button if shown.</li>
        <li>Choose <strong>Connect</strong> if ChatGPT asks. The account connection may also begin automatically during creation or installation.</li>
        <li>On Index, sign in with the <strong>same Google account you normally use for your Index sets</strong>. Complete any verification Google requests.</li>
        <li>Read Index’s consent screen and choose <strong>Allow connection</strong> if the account and permissions are correct. Wait until the browser returns to ChatGPT.</li>
      </ol>
      <p className="max-w-3xl">Each person completes their own account connection. The connector can access only that person’s sets. New sets are private; stars and study progress are outside its permissions.</p>
    </Step>

    <Step number={7} title="Confirm it works in a new chat">
      <ol className="max-w-3xl list-decimal space-y-4 pl-5">
        <li>Return to ChatGPT on the web. Switch to <strong>Work</strong> if your interface has Chat and Work tabs, then start a new conversation.</li>
        <li>Type <kbd className="rounded border border-rule bg-paper px-2 py-0.5">@</kbd> in the message box and choose the <strong>Index Study</strong> plugin you just installed.</li>
        <li>Start with this read-only request: <strong>“Find my Index study sets.”</strong> A list of your sets—or a message that you have none—confirms a successful read. An error or a request to reconnect does not.</li>
        <li>To check set creation, select Index Study again if needed, paste some notes, and ask: <strong>“Create a private Index study set from these notes.”</strong> Review any requested action confirmation.</li>
        <li>Open the returned Index link and check the saved cards. You can also refresh your Index library and look for the new title.</li>
      </ol>
      <p className="max-w-3xl">For later edits, name the set clearly. For example: “Add these three terms to my biology set.” Read access alone does not confirm that your ChatGPT plan or workspace allows create and edit actions.</p>
    </Step>

    <section className="border-t border-rule py-9" aria-labelledby="troubleshooting-title">
      <h2 id="troubleshooting-title" className="font-display text-2xl font-bold">If something looks different</h2>
      <div className="mt-5 divide-y divide-rule text-sm leading-relaxed text-ink-2">
        {[
          ['I don’t see Add custom MCP server.', 'Your account, role, workspace, or security settings may not allow it. Check OpenAI’s current availability guide or ask the workspace admin. The Index URL cannot unlock a disabled ChatGPT feature.'],
          ['DCR is unavailable or ChatGPT asks for a client secret.', 'Check the full Server URL in step 3, wait for OAuth discovery, and reopen Advanced OAuth settings. Select Dynamic Client Registration (DCR). Do not enter your Google password, a Supabase key, or a browser token into the client-secret field.'],
          ['The plugin page says Open in desktop app.', 'Go back to Plugins → Add → Add custom MCP server and follow this guide. An older saved plugin listing is a separate connection and may be limited to desktop.'],
          ['Index Study is missing from the @ menu.', 'Confirm that the new plugin is installed and connected in the same ChatGPT account/workspace. Start a new Work conversation and refresh ChatGPT if needed.'],
          ['Sign-in failed or the connection link expired.', 'Start again from the new plugin’s Connect button. Do not open Index’s consent URL directly; it needs the connection request that ChatGPT creates.'],
          ['It can find sets, but cannot create or edit them.', 'Review the plugin’s allowed actions and your workspace policies. ChatGPT may allow read tools while blocking write tools. A successful read does not remove that restriction.'],
        ].map(([title, body]) => <details className="py-4" key={title}><summary className="cursor-pointer font-semibold text-ink">{title}</summary><p className="mt-3 max-w-3xl">{body}</p></details>)}
      </div>
      <p className="mt-6 text-sm text-ink-2">To stop access later, open <Link className={external} to="/connections">Connected apps in Index</Link> and select <strong>Disconnect</strong>. You can also manage the connection from ChatGPT’s plugin settings.</p>
    </section>
    <footer className="border-t border-rule py-6 text-xs leading-relaxed text-ink-3">Reference: <a className="underline underline-offset-4" href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noopener noreferrer">OpenAI’s custom MCP instructions</a> and <a className="underline underline-offset-4" href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">availability and account requirements</a>. Screenshots are real captures from ChatGPT web, with the chat sidebar hidden.</footer>
  </Page>
}
