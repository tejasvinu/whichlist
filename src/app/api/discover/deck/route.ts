import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { SwipeEvent } from "@/models/SwipeEvent";
import { MediaFeature, IMediaFeature } from "@/models/MediaFeature";
import { UserTasteVector } from "@/models/UserTasteVector";
import {
  getTrending,
  getRecommendations,
  getMovieDetails,
  getTvDetails,
  getGenreMap,
  getTitle,
  getReleaseYear,
  TmdbSearchResult,
} from "@/lib/tmdb";
import {
  ItemFeatures,
  UserInteractionSignal,
  ScoredCandidate,
  buildUserTasteVector,
  scoreCandidate,
  mmrReorder,
  applyEpsilonGreedy,
} from "@/lib/taste";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  await connectDB();
  const userId = session.user.id;

  try {
    // 1. Fetch user's watchlist items + non-undone swipe events to build exclusion set
    // and identify seed items for recommendations
    const [watchlistDocs, swipeDocs, topSeedItems] = await Promise.all([
      WatchlistItem.find({ userId }, { tmdbId: 1, mediaType: 1 }).lean(),
      SwipeEvent.find(
        {
          userId,
          action: { $in: ["pass", "like", "watched", "never"] },
          undone: false,
        },
        { tmdbId: 1, mediaType: 1 }
      ).lean(),
      WatchlistItem.find({
        userId,
        $or: [{ rating: { $gte: 7 } }, { status: "Completed" }, { status: "Watching" }],
      })
        .sort({ rating: -1, updatedAt: -1 })
        .limit(3)
        .lean(),
    ]);

    const excludedKeys = new Set<string>();
    watchlistDocs.forEach((doc) => excludedKeys.add(`${doc.mediaType}-${doc.tmdbId}`));
    swipeDocs.forEach((doc) => excludedKeys.add(`${doc.mediaType}-${doc.tmdbId}`));

    // 2. Fetch trending pages in parallel + seed recommendations + cached TMDB genre map
    const trendingPromises = [getTrending(page), getTrending(page + 1)];
    const seedRecPromises = topSeedItems.map((seed) => {
      const seedType = (seed.mediaType || "movie") as "movie" | "tv";
      return getRecommendations(seedType, seed.tmdbId, 1)
        .then((res) => ({ ...res, seedMediaType: seedType }))
        .catch(() => ({ results: [], seedMediaType: seedType }));
    });

    const [t1, t2, genreMap, ...seedRecResults] = await Promise.all([
      trendingPromises[0].catch(() => ({ results: [] })),
      trendingPromises[1].catch(() => ({ results: [] })),
      getGenreMap().catch(() => new Map<number, string>()),
      ...seedRecPromises,
    ]);

    // 3. Pool candidates: ~40% seed recs, ~60% trending (capped at 60 total)
    const seedCandidates: (TmdbSearchResult & { source: "seed" })[] = [];
    const trendingCandidates: (TmdbSearchResult & { source: "trending" })[] = [];
    const seenCandidateKeys = new Set<string>();

    for (const recRes of seedRecResults) {
      for (const item of recRes.results || []) {
        const type = (item.media_type || recRes.seedMediaType || "movie") as "movie" | "tv";
        const key = `${type}-${item.id}`;
        if (!excludedKeys.has(key) && !seenCandidateKeys.has(key) && item.poster_path) {
          seenCandidateKeys.add(key);
          seedCandidates.push({ ...item, media_type: type, source: "seed" });
        }
      }
    }

    const allTrending = [...(t1.results || []), ...(t2.results || [])];
    for (const item of allTrending) {
      const type = (item.media_type || "movie") as "movie" | "tv";
      if (type !== "movie" && type !== "tv") continue;
      const key = `${type}-${item.id}`;
      if (!excludedKeys.has(key) && !seenCandidateKeys.has(key) && item.poster_path) {
        seenCandidateKeys.add(key);
        trendingCandidates.push({ ...item, media_type: type, source: "trending" });
      }
    }

    // Blend: up to 24 seed recs, filling remainder from trending candidates up to 60 total
    const targetSeedCount = Math.min(24, seedCandidates.length);
    const targetTrendingCount = Math.min(trendingCandidates.length, 60 - targetSeedCount);

    const candidateList = [
      ...seedCandidates.slice(0, targetSeedCount),
      ...trendingCandidates.slice(0, targetTrendingCount),
    ];

    // If still room, fill from remaining seeds or trending
    if (candidateList.length < 60 && seedCandidates.length > targetSeedCount) {
      candidateList.push(...seedCandidates.slice(targetSeedCount, targetSeedCount + (60 - candidateList.length)));
    }
    if (candidateList.length < 60 && trendingCandidates.length > targetTrendingCount) {
      candidateList.push(...trendingCandidates.slice(targetTrendingCount, targetTrendingCount + (60 - candidateList.length)));
    }

    if (candidateList.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // 4. Batch query existing MediaFeatures for candidates
    const candidateQuery = candidateList.map((c) => ({
      tmdbId: c.id,
      mediaType: c.media_type as "movie" | "tv",
    }));

    const existingFeatures = await MediaFeature.find({
      $or: candidateQuery,
    }).lean<IMediaFeature[]>();

    const featureMap = new Map<string, ItemFeatures>();
    existingFeatures.forEach((f) => {
      featureMap.set(`${f.mediaType}-${f.tmdbId}`, {
        tmdbId: f.tmdbId,
        mediaType: f.mediaType,
        genreIds: f.genreIds,
        genreNames: f.genreNames,
        keywords: f.keywords,
        topCast: f.topCast,
        creators: f.creators,
        decade: f.decade,
        lang: f.lang,
        voteAverage: f.voteAverage,
        popularity: f.popularity,
      });
    });

    // 5. Backfill missing features (parallel details fetch, capped at <= 20)
    const missingCandidates = candidateList
      .filter((c) => !featureMap.has(`${c.media_type}-${c.id}`))
      .slice(0, 20);

    if (missingCandidates.length > 0) {
      const detailFetches = missingCandidates.map(async (c) => {
        try {
          const type = c.media_type as "movie" | "tv";
          if (type === "movie") {
            const d = await getMovieDetails(c.id);
            const releaseYear = getReleaseYear(d);
            const decade = releaseYear ? Math.floor(releaseYear / 10) * 10 : 0;
            const directors = d.credits?.crew
              ?.filter((cr) => cr.job === "Director")
              .map((cr) => cr.name) || [];
            const keywords = d.keywords?.keywords?.map((k) => k.name) || [];
            const topCast = d.credits?.cast?.slice(0, 5).map((ca) => ca.name) || [];

            return {
              tmdbId: d.id,
              mediaType: "movie" as const,
              genreIds: d.genres.map((g) => g.id),
              genreNames: d.genres.map((g) => g.name),
              keywords,
              topCast,
              creators: directors,
              decade,
              lang: d.original_language || "",
              voteAverage: d.vote_average ?? c.vote_average ?? 0,
              popularity: d.popularity ?? c.popularity ?? 0,
              fetchedAt: new Date(),
            };
          } else {
            const d = await getTvDetails(c.id);
            const releaseYear = getReleaseYear(d);
            const decade = releaseYear ? Math.floor(releaseYear / 10) * 10 : 0;
            const creators =
              d.created_by?.map((cr) => cr.name) ||
              d.credits?.crew
                ?.filter((cr) => cr.job === "Director" || cr.job === "Executive Producer")
                .slice(0, 3)
                .map((cr) => cr.name) ||
              [];
            const keywords = d.keywords?.results?.map((k) => k.name) || [];
            const topCast = d.credits?.cast?.slice(0, 5).map((ca) => ca.name) || [];

            return {
              tmdbId: d.id,
              mediaType: "tv" as const,
              genreIds: d.genres.map((g) => g.id),
              genreNames: d.genres.map((g) => g.name),
              keywords,
              topCast,
              creators,
              decade,
              lang: d.original_language || "",
              voteAverage: d.vote_average ?? c.vote_average ?? 0,
              popularity: d.popularity ?? c.popularity ?? 0,
              fetchedAt: new Date(),
            };
          }
        } catch {
          return null;
        }
      });

      const fetchedDetails = (await Promise.all(detailFetches)).filter(
        (f): f is NonNullable<typeof f> => f !== null
      );

      if (fetchedDetails.length > 0) {
        try {
          await MediaFeature.insertMany(fetchedDetails, { ordered: false });
        } catch {
          // Ignore duplicate key race condition errors
        }

        fetchedDetails.forEach((f) => {
          featureMap.set(`${f.mediaType}-${f.tmdbId}`, f);
        });
      }
    }

    // 6. Check / Rebuild User Taste Vector
    let tasteDoc = await UserTasteVector.findOne({ userId }).lean<{
      weights: Record<string, number>;
      signalCount: number;
      computedAt: Date;
    } | null>();

    const [latestSwipe, latestWatchlist] = await Promise.all([
      SwipeEvent.findOne({ userId, action: { $ne: "impression" } })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean(),
      WatchlistItem.findOne({ userId })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
    ]);

    const isTasteStale =
      !tasteDoc ||
      (latestSwipe?.createdAt && new Date(latestSwipe.createdAt) > new Date(tasteDoc.computedAt)) ||
      (latestWatchlist?.updatedAt && new Date(latestWatchlist.updatedAt) > new Date(tasteDoc.computedAt));

    if (isTasteStale) {
      // Rebuild taste vector from past interactions
      const [userSwipes, userWatchlistItems] = await Promise.all([
        SwipeEvent.find({
          userId,
          action: { $in: ["pass", "like", "watched", "never"] },
          undone: false,
        })
          .sort({ createdAt: -1 })
          .limit(300)
          .lean(),
        WatchlistItem.find({ userId })
          .sort({ updatedAt: -1 })
          .limit(300)
          .lean(),
      ]);

      // Collect features for user's past items
      const pastKeys = [
        ...userSwipes.map((s) => ({ tmdbId: s.tmdbId, mediaType: s.mediaType })),
        ...userWatchlistItems.map((w) => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
      ];

      const pastFeatures = pastKeys.length
        ? await MediaFeature.find({ $or: pastKeys }).lean<IMediaFeature[]>()
        : [];

      const pastFeatureMap = new Map<string, ItemFeatures>();
      pastFeatures.forEach((pf) => {
        pastFeatureMap.set(`${pf.mediaType}-${pf.tmdbId}`, pf);
      });

      const signals: UserInteractionSignal[] = [];

      for (const swipe of userSwipes) {
        const feat = pastFeatureMap.get(`${swipe.mediaType}-${swipe.tmdbId}`) || {
          tmdbId: swipe.tmdbId,
          mediaType: swipe.mediaType,
        };
        signals.push({
          type: "swipe",
          action: swipe.action,
          timestamp: swipe.createdAt,
          features: feat,
        });
      }

      for (const w of userWatchlistItems) {
        const feat = pastFeatureMap.get(`${w.mediaType}-${w.tmdbId}`) || {
          tmdbId: w.tmdbId,
          mediaType: w.mediaType,
          decade: w.releaseYear && w.releaseYear > 1900 ? Math.floor(w.releaseYear / 10) * 10 : 0,
        };
        signals.push({
          type: "watchlist",
          status: w.status,
          rating: w.rating,
          tags: w.tags,
          timestamp: w.dateAdded || w.updatedAt || new Date(),
          features: feat,
        });
      }

      // Unswiped impressions with >= 3 serves -> soft negative signal (-0.05)
      try {
        const fatigued = await SwipeEvent.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId), action: "impression" } },
          {
            $group: {
              _id: { tmdbId: "$tmdbId", mediaType: "$mediaType" },
              count: { $sum: 1 },
              latestDate: { $max: "$createdAt" },
            },
          },
          { $match: { count: { $gte: 3 } } },
        ]);

        for (const item of fatigued) {
          const k = `${item._id.mediaType}-${item._id.tmdbId}`;
          if (!excludedKeys.has(k)) {
            const feat = pastFeatureMap.get(k) || {
              tmdbId: item._id.tmdbId,
              mediaType: item._id.mediaType,
            };
            signals.push({
              type: "swipe",
              action: "impression_fatigue",
              timestamp: item.latestDate || new Date(),
              features: feat,
            });
          }
        }
      } catch {
        // Soft fallback if aggregation fails
      }

      const { weights, signalCount } = buildUserTasteVector(signals);

      await UserTasteVector.findOneAndUpdate(
        { userId },
        { weights, signalCount, computedAt: new Date() },
        { upsert: true, new: true }
      );

      tasteDoc = { weights, signalCount, computedAt: new Date() };
    }

    const userWeights = tasteDoc?.weights || {};
    const signalCount = tasteDoc?.signalCount || 0;

    // 7. Score all candidates with rich feature mappings
    const scoredCandidates: ScoredCandidate[] = candidateList.map((c) => {
      const type = c.media_type as "movie" | "tv";
      const key = `${type}-${c.id}`;
      const releaseYear = getReleaseYear(c);
      const candidateGenres = (c.genre_ids || [])
        .map((gid) => genreMap.get(gid))
        .filter((g): g is string => Boolean(g));

      const feat: ItemFeatures = featureMap.get(key) || {
        tmdbId: c.id,
        mediaType: type,
        genreIds: c.genre_ids || [],
        genreNames: candidateGenres,
        decade: releaseYear && releaseYear > 1900 ? Math.floor(releaseYear / 10) * 10 : 0,
        lang: c.original_language || "",
        voteAverage: c.vote_average || 0,
        popularity: c.popularity || 0,
      };

      const { finalScore, matchFeatures } = scoreCandidate(feat, userWeights, signalCount);
      const matchPercentage = Math.round(Math.min(99, Math.max(15, finalScore * 100)));

      return {
        tmdbId: c.id,
        mediaType: type,
        title: getTitle(c),
        posterPath: c.poster_path,
        releaseYear,
        overview: c.overview || "",
        score: finalScore,
        matchPercentage,
        matchFeatures,
        source: c.source,
        features: feat,
      };
    });

    let finalDeck: ScoredCandidate[];
    if (signalCount === 0) {
      // Cold start: empty list -> pure trending order
      finalDeck = scoredCandidates.slice(0, 30);
    } else {
      // 8. MMR Reorder (top 30) to prevent genre monoculture
      const mmrList = mmrReorder(scoredCandidates, 0.7, 30);
      // 9. ε-greedy exploration (~1 in 8 slots swaps in an explore card from tail)
      finalDeck = applyEpsilonGreedy(mmrList, 8);
    }

    // 10. Record impressions asynchronously
    const impressionEvents = finalDeck.map((item, index) => ({
      userId,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      action: "impression" as const,
      source: item.source || "trending",
      position: index,
      undone: false,
      createdAt: new Date(),
    }));

    if (impressionEvents.length > 0) {
      SwipeEvent.insertMany(impressionEvents, { ordered: false }).catch(() => {});
    }

    // Clean response items
    const responseItems = finalDeck.map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      releaseYear: item.releaseYear,
      overview: item.overview,
      score: item.score,
      matchPercentage: item.matchPercentage,
      matchFeatures: item.matchFeatures,
      source: item.source,
    }));

    return NextResponse.json({ items: responseItems });
  } catch (err: unknown) {
    console.error("Discover deck generation error:", err);
    return NextResponse.json({ error: "Failed to generate deck" }, { status: 500 });
  }
}
