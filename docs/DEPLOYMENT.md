# ArtWall production deployment

ArtWall uses three replaceable layers:

- **GitHub** stores the source and deployment definition.
- **Render** runs one Node.js web service containing the React app and API.
- **Neon** stores PostgreSQL records and private artwork/AR images through its S3-compatible Object Storage.

No uploaded image or database record is written to Render's temporary filesystem. This makes a later move to Railway, Fly.io, AWS, or another S3/Postgres provider a configuration change instead of a rewrite.

## Environments

The Neon project has separate `development` and `production` branches. All schema and upload testing happens on `development`. Production is migrated only after `npm run check` and the smoke tests pass. Never run `npm run db:seed` against production.

## Deploy to Render

1. In Render, create a **Blueprint** from this GitHub repository. Render reads `render.yaml`.
2. Keep the `free` service plan for the MVP.
3. Supply the secret values requested during Blueprint creation:
   - `DATABASE_URL`: pooled Neon production connection string.
   - `DATABASE_URL_UNPOOLED`: direct Neon production connection string, used only for migrations.
   - `TELEGRAM_BOT_TOKEN`: token issued by BotFather.
   - `ADMIN_TELEGRAM_IDS`: comma-separated numeric Telegram IDs.
   - `STORAGE_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`: production branch Object Storage values.
4. Deploy. Render runs checks, then the start command applies versioned migrations before starting the service. The migration runner is idempotent, which makes this safe on free instances that do not support a separate pre-deploy command.
5. Verify `https://<service>.onrender.com/api/health` returns `{"ok":true,"database":"connected"}`.

Secrets stay in Render and Neon; do not add them to GitHub. Render creates `SESSION_SECRET` automatically.

## Connect Telegram last

After the HTTPS deployment is healthy:

1. Open BotFather and create or select the ArtWall bot.
2. Set its menu button / Mini App URL to the Render HTTPS URL.
3. Configure the public buyer launch link with the normal Mini App URL.
4. Use an artist start parameter such as `artist` for artist invitations. The server grants the artist role only while artist capacity is available.
5. Open the Mini App inside Telegram and test buyer, artist, camera, sharing, basket, and admin paths.

Telegram authentication is rejected if its signed launch data is older than 15 minutes. Browser preview authentication is disabled in production.

## Release and rollback

Before each release:

```bash
npm ci
npm run check
npm run db:migrate
```

Apply migrations to the development branch first. Database migrations are append-only files in `drizzle/`; never edit a migration that production has already applied. Render retains recent deploys for rollback. A code rollback does not reverse a database migration, so migrations must remain backward compatible during rollout.

## Free-tier expectations

Render's free web service sleeps after inactivity, so the first launch can take roughly a minute. It also has an ephemeral filesystem, which is why ArtWall stores all durable data in Neon. Upgrade the Render service without changing code when reliable wake-up time becomes important.

Monitor Neon and Render usage before opening registration beyond the configured 100 artists, 500 buyers, and five artworks per artist. These limits are enforced atomically by the API, not only in the interface.

## Moving providers later

- **Render to Railway/Fly/AWS:** reuse the same build, migration, start commands, and environment variables.
- **Neon Postgres to another Postgres:** restore a standard PostgreSQL dump and change both database URLs.
- **Neon Object Storage to S3/R2:** copy the objects and change the S3 endpoint, region, bucket, and credentials.
- **Custom domain:** add it at the host, then update BotFather's Mini App URL. No code change is required.

