# Plan: `/discover` — Tinder-Style Swipe Deck with ML-Personalized Feed

## Overview

A new auth-gated `/discover` page with a swipeable card deck of movies/TV. Gestures
write to the watchlist via existing API contracts; a new `SwipeEvent` log records
implicit feedback that trains a zero-dependency content-based ranker, blended with
TMDB `/recommendations` candidates and diversified via MMR + ε-greedy exploration.

## Locked Decisions

| Choice | Decision |
|---|---|
| Placement | New `/discover` route; NavBar link between "Universes" and "My List" |
| Feed | Paginated TMDB trending + `/recommendations` seed blend |
| Right swipe | Add to watchlist, `status: "Plan to Watch"` (silent) |
| Left swipe | Pass — logged as soft signal only, item excluded from deck |
| Up swipe | Mark `status: "Completed"` silently + undo toast |
| Long-press | Popup menu: **Watched** (opens WatchlistModal for rating) / **Never** / **Details** |
| Never | `status: "Dropped"` + `tags: ["not-interested"]` — existing convention |
| Gesture engine | Hand-rolled Pointer Events + WAAPI — **zero new dependencies** |
| ML | Content scorer + TMDB-recs blend + MMR/ε-greedy (embeddings deferred to v2) |

## Gesture Layer

`SwipeCard` — client component, **not** a `<Link>` (iOS long-press triggers anchor
preview; MediaCard cannot be reused as-is).

- `pointerdown` → `setPointerCapture(e.pointerId)`, record origin/timestamp, start
  500ms long-press timer, keep a small velocity-sample ring buffer.
- `pointermove` → write `translate3d(dx, dy, 0) rotate(dx / 20deg)` directly to
  `style.transform` (no re-render); cancel long-press timer once displacement > 10px.
- `pointerup` / `pointercancel` → commit if `|dx| > 120px` or velocity > ~0.5 px/ms;
  direction = dominant axis (|dy| > |dx| && dy < 0 → up). Fly-off via
  `element.animate()` continuing finger trajectory; snap-back via CSS transition.
- Long-press fires → `longPressFired` flag suppresses swipe commit, card springs
  home, popup opens. Tap (<10px, <500ms) = open Details.
- Stamp badges (WANT / PASS / SEEN) fade in proportionally to drag distance —
  hard-bordered rotated mono badges, brutalist.
- iOS/mobile requirements: `touch-action: none` on card (or `pan-y` if page must
  scroll), `-webkit-touch-callout: none`, `select-none`, `onContextMenu` prevented,
  `draggable={false}` + `-webkit-user-drag: none` on images, ignore non-primary
  pointers, swallow the `click` that follows `pointerup` after a drag. No haptics
  on iOS web (Apple patched the workaround) — visual feedback is primary.
- Deck renders top 3 cards only; behind-cards `scale(1 - i*0.04)` + `translateY`.
- Prefetch next batch when ≤3 cards remain; preload next 2–3 poster images.
- Desktop: ✕ / ↑ / ✓ buttons below deck trigger the same commit path (including a
  brief stamp flash); ArrowLeft/ArrowUp/ArrowRight keys; `U`/`Backspace` = undo;
  tap/Enter = details. Visible focus ring, `aria-live` announcements ("Added X").
- Sounds: reuse `sound.play("success")` / `"trash"` / `"laser"`. Dispatch
  `window` event `"watchlist-updated"` after writes (existing convention).
- Empty deck → "caught up" state with Load More / adjust taste CTAs.

## API & Data

### `GET /api/discover/deck?page=N`

1. `auth()` + `connectDB()` (existing route conventions).
2. Parallel: `getTrending(page)`, `getTrending(page+1)`; seed recs via
   `getRecommendations(type, id)` on the user's top-3 rated items; fetch user's
   `WatchlistItem` `(tmdbId, mediaType)` set + `SwipeEvent` decided set
   (pass/like/watched/never) for exclusion.
3. Merge candidates (~40% seed recs / ~60% trending), dedupe by
   `mediaType-tmdbId`, drop excluded, cap ~60.
4. `MediaFeature.find` for candidates → parallel detail backfill (≤20 calls, only
   for items no user has seen before) → `insertMany`.
5. Load/rebuild `UserTasteVector` (gated by "any newer WatchlistItem/SwipeEvent?").
6. Score → shrinkage blend with quality prior → MMR reorder top-30 → ε-greedy
   inject → `insertMany` impression events → return
   `[{tmdbId, mediaType, title, posterPath, releaseYear, score, matchFeatures}]`.

### `POST /api/discover/swipe`

Body: `{tmdbId, mediaType, action: "like"|"pass"|"watched"|"never", position, source, itemSnapshot}`.
Inserts `SwipeEvent` (with `prevItemSnapshot` = prior WatchlistItem doc or null).
For `like`/`watched`/`never` also upserts WatchlistItem via shared
`lib/watchlist.ts` helper (extracted from `api/watchlist/route.ts`):
`like` → `Plan to Watch`; `watched` → `Completed`; `never` → `Dropped` +
`tags:["not-interested"]` (merge with existing tags — raw POST to `/api/watchlist`
omitting `tags` would wipe them).

### `POST /api/discover/undo`

Finds latest non-undone `SwipeEvent` → restores `prevItemSnapshot` (null snapshot =
delete the upserted item) → marks event `undone: true`. Client re-inserts the card
at the front of the deck.

## Models

```ts
// src/models/SwipeEvent.ts
{ userId: ObjectId (idx), tmdbId: Number, mediaType: "movie"|"tv",
  action: "impression"|"pass"|"like"|"watched"|"never"|"undo",
  source: "trending"|"seed", position: Number,
  prevItemSnapshot: Mixed, undone: {Boolean, default false}, createdAt }
// indexes: {userId, createdAt:-1}, {userId, tmdbId, mediaType}

// src/models/MediaFeature.ts — global (cross-user) feature cache
{ tmdbId, mediaType } unique, genreIds[], genreNames[], keywords[], topCast[],
  creators[], decade, lang, voteAverage, popularity, fetchedAt
// v2: embedding: Number[]

// src/models/UserTasteVector.ts
{ userId unique, weights: Record<string, number>, signalCount, computedAt }
```

## ML Pipeline (`src/lib/taste.ts`, pure functions)

- **User vector** — sparse `feature → weight` map over
  `genre:{id}`, `kw:{name}`, `cast:{id}`, `dir:{name}`, `decade:{YYYYs}`,
  `type:{movie|tv}`, `lang:{iso}`.
  Signal weights: `watched` +1.5 · `Completed` (rating−5.5)/4.5 · `like`/`Plan to
  Watch` +0.5–0.9 · `Watching` +0.6 · `never`/`not-interested` −1.5 (permanent) ·
  `pass` −0.25 (14-day decay) · unswiped impression ≥3 serves −0.05.
  All weights decay `exp(−Δdays/45)` (passes τ=14).
- **Cold start** — shrinkage `final = (n/(n+k))·personal + (k/(n+k))·qualityPrior`,
  k≈15; quality prior = normalized `vote_average` + `popularity` (~0.15 weight).
  Empty list → pure trending order. Personalization live within ~5 swipes.
- **Candidates** — ~60% scored trending + ~40% TMDB `/recommendations` seeded from
  top-3 rated items (borrowed collaborative filtering).
- **MMR reorder** — greedy `λ·score − (1−λ)·maxJaccard(genres+keywords)`, λ=0.7,
  top-30 — prevents genre monoculture.
- **ε-greedy** — ~1-in-8 slots swaps in an explore card from the low-scored tail.
- **Explainability** — return top contributing features per card → card badge like
  `MATCH 82 — crime · park chan-wook`.

Vector recomputes lazily on deck GET when newer activity exists (bounded
aggregation over a few hundred docs, ~10–30ms).

## Files

**New**
- `src/app/discover/page.tsx` — server: auth gate → `<Block>` header + `<SwipeDeck>`
- `src/components/SwipeDeck.tsx` — deck state, fetch/prefetch, history/undo
- `src/components/SwipeCard.tsx` — pointer-event gesture card + stamps
- `src/components/SwipePopup.tsx` — long-press menu (Watched/Never/Details)
- `src/app/api/discover/deck/route.ts`
- `src/app/api/discover/swipe/route.ts`
- `src/app/api/discover/undo/route.ts`
- `src/models/SwipeEvent.ts`, `src/models/MediaFeature.ts`,
  `src/models/UserTasteVector.ts`
- `src/lib/taste.ts`, `src/lib/watchlist.ts` (extracted shared upsert)

**Edit**
- `src/lib/tmdb.ts` — `getTrending(page)`, `getRecommendations(type,id)`,
  `getGenreMap()` (cached), extend `TmdbSearchResult` with `genre_ids`,
  `popularity`, `vote_count`, `original_language`; add `keywords` to details'
  `append_to_response` (movie `keywords.keywords[]`, tv `keywords.results[]`)
- `src/app/api/watchlist/route.ts` — consume extracted upsert helper
- `src/components/NavBar.tsx` — "Discover" link (~line 58, inside session block)
- `src/app/globals.css` — `touch-action`/selection/callout utilities if needed
- `src/lib/audio.ts` — optional `whoosh` sound

## Edge Cases

- Fire-and-forget swipe writes; on failure → toast + reinsert card. Upsert key
  `(userId, tmdbId, mediaType)` makes retries idempotent.
- Re-right-swiping a previously `not-interested` item re-activates it (upsert
  replaces tags — desired "undismiss" behavior).
- `never` on an existing item must PATCH-merge tags, not POST (which resets
  `tags: []` and `dateAdded`).
- 401 → redirect `/auth/signin?callbackUrl=/discover`.
- `pointercancel` = treat as drag-end (browser hijacked scroll); `touch-action`
  set correctly so vertical page scroll still works.
- Trending pages dedupe server-side; TMDB `total_pages` exhaustion → end state.

## Build Order

1. `tmdb.ts` extensions + `lib/watchlist.ts` extraction + models
2. `/api/discover/{deck,swipe,undo}` + `lib/taste.ts`
3. `SwipeCard`/`SwipeDeck`/`SwipePopup` + `/discover` page + NavBar link
4. Undo toast, empty state, keyboard/buttons, iOS hardening pass
5. `npm run lint` + `next build` + manual swipe QA (mouse + touch emulation)

## v2 Upgrade Path (additive)

- `embedding: Number[768]` on `MediaFeature` via `gemini-embedding-001`
  (`taskType: RETRIEVAL_DOCUMENT`, ~$0.006/1k items); user centroid vector;
  blended score `α·feature + β·cosine` (β≈0.4). In-memory cosine over candidate
  pool — no Atlas `$vectorSearch` needed until pool > ~10k docs.
- Thompson sampling (per-genre Beta posteriors from SwipeEvent aggregates)
  replaces ε-greedy.
- Optional "AI-curated deck" mode reusing the quick-start prompt shape.
