# ArtWall Telegram Mini App

ArtWall is a Telegram-native art marketplace. Buyers discover, like, collect, and place artwork on their wall with a live camera or room photo. Artists build a profile, publish up to five artworks, create AR views, and share them. An admin dashboard reports users, artworks, views, likes, basket activity, and AR attempts.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS
- Node.js and Express API
- Neon PostgreSQL with versioned SQL migrations
- Private S3-compatible object storage with signed image URLs
- Telegram Mini App signed authentication
- Render Blueprint deployment

The database, storage, and host are connected through environment variables, so each provider can be changed later.

## Local development

Requires Node.js 22 and access to a PostgreSQL database plus S3-compatible private storage.

```bash
npm install
copy .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Set `PREVIEW_AUTH_ENABLED=true` only for local development. The app runs at `http://localhost:3000` and the API at `http://localhost:3001` through Vite's proxy.

## Checks

```bash
npm run check
```

This performs the TypeScript check and production web build. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the safe production procedure and Telegram launch checklist.

## Capacity controls

The MVP defaults to 100 artists, 500 buyer-only accounts, five artworks per artist, and 5 MB per uploaded image. The API enforces these values transactionally. Change them later with environment variables rather than code changes.

