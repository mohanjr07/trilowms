# Moving TriloWMS off Lovable: Cloudflare + your own Supabase

The app now builds and deploys on its own. It no longer needs Lovable's build
tooling, and the Supabase connection comes from two settings instead of being
written into the code.

Tested here: `npm ci`, `npm run build`, the built Worker answering `/` and
`/inventory` locally on Cloudflare's runtime, and `wrangler deploy --dry-run`.
Not tested: a real deploy, because that needs your Cloudflare account.

## What was changed in the code

| File | Change |
|---|---|
| `vite.config.ts` | Standalone config. Lovable's wrapper is removed. |
| `wrangler.jsonc` | Worker name is `trilowms`. Logging turned on. |
| `package.json`, `package-lock.json` | Vite 8 (TanStack Start needs it), no Lovable packages, `npm run deploy` added. |
| `src/lib/supabase.ts` | Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| `src/lib/wms-editor-store.ts` | If those are not set, the layout is saved in the browser only and nothing crashes. |
| `supabase/migrations/001_wms_snapshots.sql` | Creates the one table the app uses. |
| `.env.example`, `.gitignore` | Template for the two settings. `.env` is now ignored. |

**Delete `bun.lock`** from the repo. The new `package-lock.json` replaces it.
Two lock files would confuse the build.

## Step 1. Your own Supabase project

1. Sign in at supabase.com with an account you own. Create a **New project**.
   Save the database password.
2. Open **SQL Editor**, paste all of `supabase/migrations/001_wms_snapshots.sql`, press **Run**.
3. Open **Project Settings, API**. Copy the **Project URL** and the **anon public key**.

### Bring your saved warehouse layout across

The layout is the only thing stored in Supabase. In the OLD project's SQL Editor run:

```sql
select json_build_object('w', warehouses, 'a', active_id)::text
from wms_snapshots where id = 1;
```

Copy the result. In the NEW project's SQL Editor run this, pasting the result
between the `$json$` marks:

```sql
insert into wms_snapshots (id, warehouses, active_id)
select 1, j->'w', j->>'a'
from (select $json$PASTE_HERE$json$::jsonb as j) t
on conflict (id) do update
  set warehouses = excluded.warehouses, active_id = excluded.active_id;
```

If the old database is owned by Lovable and you cannot open it, ask Lovable
support for an export, or rebuild the layout in Warehouse Builder (it autosaves
to the new project).

## Step 2. Deploy to Cloudflare

**Option A, recommended: build from GitHub.**
1. Cloudflare dashboard, **Workers & Pages, Create, Import a repository**. Pick `mohanjr07/trilowms`.
2. Project name: `trilowms`. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
3. Under **Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build variables.
   They are baked in at build time, so change them and redeploy together.
4. Save and deploy. Every push to `main` then deploys automatically.

**Option B: from your computer.**
```
cp .env.example .env      # fill in the two values
npm ci
npx wrangler login
npm run deploy
```

## Step 3. Your domain

1. The domain must be on Cloudflare. If it is not, **Add a site** in Cloudflare and
   change the nameservers at your registrar to the two Cloudflare gives you.
2. If the domain currently points to Lovable, remove it in Lovable first and
   delete the old DNS records that point to Lovable.
3. Worker `trilowms`, **Settings, Domains & Routes, Add, Custom domain**. Enter
   e.g. `wms.yourdomain.com`. Cloudflare creates the DNS record and the HTTPS certificate.

## Step 4. Disconnect Lovable

Only after the new site works: in Lovable, disconnect Supabase and remove the
domain. You can keep the Lovable project as a backup.

## Things to know

- **Browser data does not move.** Everything except the warehouse layout (SKUs,
  stock, orders, inbound, putaway, and so on) is saved in each browser, not in
  Supabase. A new domain is a new browser store, so it starts empty. Reload stock
  with Bulk upload, or ask for a data export and import feature.
- **The database is open to the public key.** The app has no Supabase sign-in, so
  the table lets anyone with your site's key read and change the layout row. Fine
  for testing. Before real use, add real sign-in and tighten the policies.
- **PTL Bridge.** If your Bridge restricts which websites may call it, add the new domain.
- The link preview image in `src/routes/__root.tsx` is still a Lovable-hosted
  picture. Replace it with your own when convenient.
