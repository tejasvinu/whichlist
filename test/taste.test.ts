import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractFeatureKeys,
  calculateSignalWeight,
  buildUserTasteVector,
  calculateQualityPrior,
  scoreCandidate,
  jaccardSimilarity,
  mmrReorder,
  applyEpsilonGreedy,
} from "../src/lib/taste.ts";
import type {
  ItemFeatures,
  UserInteractionSignal,
  ScoredCandidate,
} from "../src/lib/taste.ts";

describe("ML Pipeline: taste.ts", () => {
  describe("extractFeatureKeys", () => {
    test("extracts normalized feature keys properly", () => {
      const item: ItemFeatures = {
        tmdbId: 101,
        mediaType: "movie",
        genreNames: ["Action", "Sci-Fi"],
        keywords: ["space travel", "Rebellion"],
        creators: ["Christopher Nolan"],
        topCast: ["Matthew McConaughey", "Anne Hathaway"],
        decade: 2010,
        lang: "EN",
      };

      const keys = extractFeatureKeys(item);
      assert.ok(keys.includes("genre:action"));
      assert.ok(keys.includes("genre:sci-fi"));
      assert.ok(keys.includes("kw:space travel"));
      assert.ok(keys.includes("kw:rebellion"));
      assert.ok(keys.includes("dir:christopher nolan"));
      assert.ok(keys.includes("cast:matthew mcconaughey"));
      assert.ok(keys.includes("decade:2010s"));
      assert.ok(keys.includes("type:movie"));
      assert.ok(keys.includes("lang:en"));
    });

    test("handles empty and edge case values", () => {
      const emptyItem: ItemFeatures = {
        tmdbId: 0,
        mediaType: "tv",
      };
      const keys = extractFeatureKeys(emptyItem);
      assert.deepEqual(keys, ["type:tv"]);

      const oldItem: ItemFeatures = {
        tmdbId: 1,
        mediaType: "movie",
        decade: 1890, // <= 1900 should be omitted
      };
      assert.deepEqual(extractFeatureKeys(oldItem), ["type:movie"]);

      const genreIdItem: ItemFeatures = {
        tmdbId: 2,
        mediaType: "movie",
        genreIds: [28, 878],
      };
      const gidKeys = extractFeatureKeys(genreIdItem);
      assert.ok(gidKeys.includes("genre:28"));
      assert.ok(gidKeys.includes("genre:878"));
      assert.ok(gidKeys.includes("type:movie"));
    });
  });

  describe("calculateSignalWeight & Decay", () => {
    const now = new Date("2026-09-25T12:00:00Z");

    test("evaluates swipe action weights and permanence", () => {
      // Watched swipe = +1.5
      const watchedSignal: UserInteractionSignal = {
        type: "swipe",
        action: "watched",
        timestamp: now,
        features: { tmdbId: 1, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(watchedSignal, now), 1.5);

      // Like swipe = +0.7
      const likeSignal: UserInteractionSignal = {
        type: "swipe",
        action: "like",
        timestamp: now,
        features: { tmdbId: 2, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(likeSignal, now), 0.7);

      // Pass swipe = -0.25 (τ = 14)
      const passSignal: UserInteractionSignal = {
        type: "swipe",
        action: "pass",
        timestamp: now,
        features: { tmdbId: 3, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(passSignal, now), -0.25);

      // Impression fatigue = -0.05 (τ = 14)
      const fatigueSignal: UserInteractionSignal = {
        type: "swipe",
        action: "impression_fatigue",
        timestamp: now,
        features: { tmdbId: 35, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(fatigueSignal, now), -0.05);

      // Never swipe = -1.5 permanent
      const neverSignal: UserInteractionSignal = {
        type: "swipe",
        action: "never",
        timestamp: new Date("2020-01-01T00:00:00Z"), // Long ago
        features: { tmdbId: 4, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(neverSignal, now), -1.5);
    });

    test("evaluates watchlist rating and tags", () => {
      // Rating 10: (10 - 5.5) / 4.5 = +1.0
      const rated10: UserInteractionSignal = {
        type: "watchlist",
        status: "Completed",
        rating: 10,
        timestamp: now,
        features: { tmdbId: 5, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(rated10, now), 1.0);

      // Rating 1: (1 - 5.5) / 4.5 = -1.0
      const rated1: UserInteractionSignal = {
        type: "watchlist",
        status: "Completed",
        rating: 1,
        timestamp: now,
        features: { tmdbId: 6, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(rated1, now), -1.0);

      // Tagged not-interested is permanent -1.5
      const notInterested: UserInteractionSignal = {
        type: "watchlist",
        status: "Plan to Watch",
        tags: ["not-interested"],
        timestamp: new Date("2021-05-01Z"),
        features: { tmdbId: 7, mediaType: "movie" },
      };
      assert.equal(calculateSignalWeight(notInterested, now), -1.5);
    });

    test("applies exponential time decay properly", () => {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const passSignal: UserInteractionSignal = {
        type: "swipe",
        action: "pass",
        timestamp: fourteenDaysAgo,
        features: { tmdbId: 8, mediaType: "movie" },
      };
      const passWeight = calculateSignalWeight(passSignal, now);
      // Decay after 14 days with tau=14 should be -0.25 * exp(-1) ≈ -0.091969
      assert.ok(Math.abs(passWeight - -0.25 * Math.exp(-1)) < 1e-4);

      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
      const likeSignal: UserInteractionSignal = {
        type: "swipe",
        action: "like",
        timestamp: fortyFiveDaysAgo,
        features: { tmdbId: 9, mediaType: "movie" },
      };
      const likeWeight = calculateSignalWeight(likeSignal, now);
      // Decay after 45 days with tau=45 should be 0.7 * exp(-1) ≈ 0.2575
      assert.ok(Math.abs(likeWeight - 0.7 * Math.exp(-1)) < 1e-4);
    });
  });

  describe("buildUserTasteVector", () => {
    test("accumulates sparse feature weights from multiple signals", () => {
      const now = new Date("2026-09-25T12:00:00Z");
      const signals: UserInteractionSignal[] = [
        {
          type: "swipe",
          action: "watched",
          timestamp: now,
          features: {
            tmdbId: 1,
            mediaType: "movie",
            genreNames: ["Sci-Fi"],
            creators: ["Christopher Nolan"],
          },
        },
        {
          type: "swipe",
          action: "pass",
          timestamp: now,
          features: {
            tmdbId: 2,
            mediaType: "movie",
            genreNames: ["Horror"],
          },
        },
        {
          type: "watchlist",
          status: "Plan to Watch",
          timestamp: now,
          features: {
            tmdbId: 3,
            mediaType: "movie",
            genreNames: ["Sci-Fi"],
          },
        },
      ];

      const { weights, signalCount } = buildUserTasteVector(signals, now);
      assert.equal(signalCount, 3);
      // Sci-Fi = +1.5 (watched) + 0.7 (Plan to Watch) = +2.2
      assert.ok(Math.abs(weights["genre:sci-fi"] - 2.2) < 1e-4);
      // Christopher Nolan = +1.5
      assert.ok(Math.abs(weights["dir:christopher nolan"] - 1.5) < 1e-4);
      // Horror = -0.25
      assert.ok(Math.abs(weights["genre:horror"] - -0.25) < 1e-4);
    });
  });

  describe("calculateQualityPrior", () => {
    test("computes bounded, weighted prior from voteAverage and popularity", () => {
      const priorHigh = calculateQualityPrior(9.0, 500);
      assert.ok(priorHigh > 0.8 && priorHigh <= 1.0);

      const priorLow = calculateQualityPrior(2.0, 5);
      assert.ok(priorLow < 0.4 && priorLow >= 0);

      const priorZero = calculateQualityPrior(0, 0);
      assert.equal(priorZero, 0);

      const priorMax = calculateQualityPrior(10, 10000);
      assert.ok(priorMax <= 1.0);
    });
  });

  describe("scoreCandidate & Cold Start Shrinkage", () => {
    const candidateItem: ItemFeatures = {
      tmdbId: 200,
      mediaType: "movie",
      genreNames: ["Action", "Sci-Fi"],
      keywords: ["heist"],
      creators: ["Christopher Nolan"],
      voteAverage: 8.4,
      popularity: 120,
    };

    test("cold start (0 signals): pure quality prior", () => {
      const userWeights = {};
      const signalCount = 0;

      const scored = scoreCandidate(candidateItem, userWeights, signalCount, 15);
      // shrinkage = 0 / 15 = 0 -> finalScore equals qualityPrior
      assert.equal(scored.finalScore, scored.qualityPrior);
      // Explainability fallback to genre
      assert.deepEqual(scored.matchFeatures, ["action", "sci-fi"]);
    });

    test("warm profile with positive matching features increases score", () => {
      const userWeights = {
        "dir:christopher nolan": 3.0,
        "genre:sci-fi": 2.5,
      };
      const signalCount = 15; // shrinkage = 15 / 30 = 0.5

      const scored = scoreCandidate(candidateItem, userWeights, signalCount, 15);
      assert.ok(scored.personalScore > 0.5);
      assert.ok(scored.finalScore > scored.qualityPrior);
      assert.deepEqual(scored.matchFeatures, ["christopher nolan", "sci-fi"]);
    });

    test("negative matching features lower the score", () => {
      const userWeights = {
        "genre:action": -3.5,
        "dir:christopher nolan": -2.0,
      };
      const signalCount = 15;

      const scored = scoreCandidate(candidateItem, userWeights, signalCount, 15);
      assert.ok(scored.personalScore < 0.5);
      assert.ok(scored.finalScore < scored.qualityPrior);
    });
  });

  describe("jaccardSimilarity", () => {
    test("calculates genre + keyword overlap accurately", () => {
      const a: ItemFeatures = {
        tmdbId: 1,
        mediaType: "movie",
        genreNames: ["Action", "Thriller"],
        keywords: ["heist"],
      };
      const b: ItemFeatures = {
        tmdbId: 2,
        mediaType: "movie",
        genreNames: ["Action", "Thriller"],
        keywords: ["heist"],
      };
      assert.equal(jaccardSimilarity(a, b), 1.0);

      const c: ItemFeatures = {
        tmdbId: 3,
        mediaType: "movie",
        genreNames: ["Drama"],
        keywords: ["romance"],
      };
      assert.equal(jaccardSimilarity(a, c), 0.0);

      const d: ItemFeatures = {
        tmdbId: 4,
        mediaType: "movie",
        genreNames: ["Action", "Drama"], // 1 overlap in genre (action), total union: Action, Thriller, Drama, heist = 4
      };
      // intersection = 1, union = 4 -> 0.25
      assert.equal(jaccardSimilarity(a, d), 0.25);
    });
  });

  describe("mmrReorder", () => {
    test("diversifies candidates when top items have identical features", () => {
      const itemAction1: ScoredCandidate = {
        tmdbId: 1,
        mediaType: "movie",
        title: "Action Movie 1",
        posterPath: null,
        releaseYear: 2020,
        overview: "",
        score: 0.95,
        matchPercentage: 95,
        matchFeatures: ["action"],
        features: { tmdbId: 1, mediaType: "movie", genreNames: ["Action"], keywords: ["guns"] },
      };

      const itemAction2: ScoredCandidate = {
        tmdbId: 2,
        mediaType: "movie",
        title: "Action Movie 2",
        posterPath: null,
        releaseYear: 2021,
        overview: "",
        score: 0.94, // Very close score to Action 1
        matchPercentage: 94,
        matchFeatures: ["action"],
        features: { tmdbId: 2, mediaType: "movie", genreNames: ["Action"], keywords: ["guns"] },
      };

      const itemDrama: ScoredCandidate = {
        tmdbId: 3,
        mediaType: "movie",
        title: "Drama Masterpiece",
        posterPath: null,
        releaseYear: 2022,
        overview: "",
        score: 0.88, // Slightly lower score, but completely distinct genre
        matchPercentage: 88,
        matchFeatures: ["drama"],
        features: { tmdbId: 3, mediaType: "movie", genreNames: ["Drama"], keywords: ["family"] },
      };

      const reordered = mmrReorder([itemAction1, itemAction2, itemDrama], 0.6, 3);
      // Action 1 is picked first (highest score)
      assert.equal(reordered[0].tmdbId, 1);
      // Because Action 2 has Jaccard sim 1.0 with Action 1, its MMR score is penalized:
      // Action 2 MMR: 0.6 * 0.94 - 0.4 * 1.0 = 0.564 - 0.4 = 0.164
      // Drama MMR: 0.6 * 0.88 - 0.4 * 0.0 = 0.528
      // Therefore, Drama Masterpiece must be promoted to position 2!
      assert.equal(reordered[1].tmdbId, 3);
      assert.equal(reordered[2].tmdbId, 2);
    });
  });

  describe("applyEpsilonGreedy", () => {
    test("swaps in tail card at every 8th position", () => {
      const candidates: ScoredCandidate[] = Array.from({ length: 24 }, (_, i) => ({
        tmdbId: i + 1,
        mediaType: "movie",
        title: `Card ${i + 1}`,
        posterPath: null,
        releaseYear: 2020,
        overview: "",
        score: 1 - i * 0.03,
        matchPercentage: 90 - i,
        matchFeatures: [],
      }));

      const withExploration = applyEpsilonGreedy(candidates, 8);
      assert.equal(withExploration.length, 24);
      // Item at slot 7 (the 8th card, 0-indexed) should now come from the tail (id >= 16)
      assert.ok(withExploration[7].tmdbId >= 16);
    });

    test("leaves short arrays untouched", () => {
      const shortList: ScoredCandidate[] = Array.from({ length: 5 }, (_, i) => ({
        tmdbId: i + 1,
        mediaType: "movie",
        title: `Card ${i + 1}`,
        posterPath: null,
        releaseYear: 2020,
        overview: "",
        score: 0.8,
        matchPercentage: 80,
        matchFeatures: [],
      }));

      const result = applyEpsilonGreedy(shortList, 8);
      assert.equal(result.length, 5);
      assert.deepEqual(result, shortList);
    });
  });
});
