# Running CSDP Tracker on Cloudflare (free)

Everything Cloudflare needs lives in this folder. The app's own files are not
changed: `build.mjs` copies the app to a separate folder next to the project
(`../csdp-tracker-cloudflare-build`), adds the Cloudflare settings there, and
builds that copy.

## What's in here

| File | What it is |
|---|---|
| `build.mjs` | Builds the Cloudflare version, and can preview or publish it |
| `wrangler.jsonc` | Cloudflare Worker settings (name, Node.js support) |
| `open-next.config.template.txt` | Settings for the adapter that runs Next.js on Cloudflare (copied in as `open-next.config.ts`) |
| `backup-timer.github-workflow.yml` | The nightly backup timer, run by GitHub instead of Vercel |

## Steps

1. **Build and try it locally** (no Cloudflare account needed):
   `node cloudflare/build.mjs preview`, then open the address it prints.
2. **Sign in to Cloudflare once:** in the build folder, run `npx wrangler login`
   (a browser window opens; sign in there yourself).
3. **Add the secret settings** on the worker (Cloudflare dashboard -> Workers ->
   csdp-tracker -> Settings -> Variables and Secrets):
   - `SUPABASE_SERVICE_ROLE_KEY` (used only by the nightly backup)
   - `CRON_SECRET` (any long random value; the backup timer sends it)

   The two `NEXT_PUBLIC_SUPABASE_*` values are built in from `.env.local`.
4. **Publish:** `node cloudflare/build.mjs deploy`. It prints the new address,
   e.g. `https://csdp-tracker.<your-account>.workers.dev`.
5. **Let people sign in at the new address:** Supabase -> Authentication -> URL
   Configuration -> add the new address to Site URL / Redirect URLs.
6. **Nightly backup:** follow the steps at the top of
   `backup-timer.github-workflow.yml`.

## Free plan limits to know

- 100,000 requests a day.
- 10 ms of processing time per request on the free plan (time spent waiting for
  the database doesn't count). Heavy pages may hit this; making each page load
  only its own data keeps them well under it.
