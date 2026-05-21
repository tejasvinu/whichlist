# whichlist

A brutalist movie & TV watchlist tracker built with Next.js, MongoDB, and TMDB.

## Phase 1 Features

- **Discovery:** Trending dashboard, global TMDB search, detailed media pages (poster, cast, trailer)
- **Auth:** Email/password registration, Google & GitHub OAuth via NextAuth
- **Watchlist:** Full CRUD with status, rating (1–10), and review
- **Library:** Filter by type/status, sort by date added, rating, or release year

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in `MONGODB_URI`, `TMDB_API_KEY`, and `AUTH_SECRET`.

3. Optional: configure Google/GitHub OAuth credentials.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS v4
- MongoDB + Mongoose
- NextAuth.js v5
- TMDB API
