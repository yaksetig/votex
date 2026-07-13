# Production release integrity

The `Release production` workflow runs only after `CI` succeeds on `main`. It
applies every committed migration, deploys the complete Edge Function
manifest, uploads the already-built artifact to Cloudflare Pages, waits for that exact Git commit,
and then tests the live database, function inventory, CORS policy, fixed
authority, RP signature service, public ledger, and frontend.

## One-time GitHub configuration

Configure these repository variables:

- `PRODUCTION_RELEASE_ENABLED=true`
- `SUPABASE_PROJECT_ID=uficgolgcwvgxqlubpso`
- `VITE_SUPABASE_URL=https://uficgolgcwvgxqlubpso.supabase.co`
- `VOTEX_APP_URL=https://votex.world`
- `CLOUDFLARE_PAGES_PROJECT=<the existing Pages project name>`

Configure these repository or `production` environment secrets without adding
their values to source control:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Give the Cloudflare token the minimum Pages edit permission for the configured
account. Disable the Cloudflare Pages push-triggered production build after the
workflow is enabled; otherwise Cloudflare can publish the frontend before CI and
the backend release finish. Preview-branch builds may remain enabled. Direct
artifact upload is intentional: a deploy hook builds whatever is newest on the
branch, while this workflow publishes the exact commit that passed CI.

GitHub's `production` environment should require an authorized reviewer if a
manual approval is desired. The workflow concurrency group prevents two
production releases from applying simultaneously.

## Local checks

```sh
npm run release:check
```

This fails when a local Edge Function is missing from `release.config.json`, a
declared function is missing locally, `verify_jwt` differs from
`supabase/config.toml`, or migration filenames are malformed or duplicated.

With a linked and authenticated Supabase CLI plus the documented environment
variables, the live checks can be run without deploying:

```sh
npm run release:verify
```

Never place an authority secret, service-role key, Supabase access token,
database password, or Cloudflare API token in repository files or logs.
