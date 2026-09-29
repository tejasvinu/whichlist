export interface ItemFeatures {
  tmdbId: number;
  mediaType: "movie" | "tv";
  genreNames?: string[];
  genreIds?: number[];
  keywords?: string[];
  topCast?: string[];
  creators?: string[];
  decade?: number;
  lang?: string;
  voteAverage?: number;
  popularity?: number;
}

export interface UserInteractionSignal {
  type: "swipe" | "watchlist";
  action?: string; // "pass" | "like" | "watched" | "never"
  status?: string; // "Plan to Watch" | "Completed" | "Watching" | "Dropped"
  rating?: number | null;
  tags?: string[];
  timestamp: Date;
  features: ItemFeatures;
}

export interface ScoredCandidate {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  overview: string;
  score: number;
  matchPercentage: number;
  matchFeatures: string[];
  source?: "trending" | "seed";
  features?: ItemFeatures;
}

/**
 * Extracts normalized feature keys from an item's metadata.
 * Keys: genre:{name}, kw:{keyword}, cast:{actor}, dir:{director}, decade:{YYYYs}, type:{type}, lang:{iso}
 */
export function extractFeatureKeys(item: ItemFeatures): string[] {
  const keys: string[] = [];

  if (item.genreNames && item.genreNames.length > 0) {
    for (const g of item.genreNames) {
      if (g) keys.push(`genre:${g.toLowerCase().trim()}`);
    }
  } else if (item.genreIds && item.genreIds.length > 0) {
    for (const gid of item.genreIds) {
      if (gid != null) keys.push(`genre:${gid}`);
    }
  }

  if (item.keywords) {
    for (const kw of item.keywords.slice(0, 10)) {
      if (kw) keys.push(`kw:${kw.toLowerCase().trim()}`);
    }
  }

  if (item.creators) {
    for (const d of item.creators) {
      if (d) keys.push(`dir:${d.toLowerCase().trim()}`);
    }
  }

  if (item.topCast) {
    for (const c of item.topCast.slice(0, 5)) {
      if (c) keys.push(`cast:${c.toLowerCase().trim()}`);
    }
  }

  if (item.decade && item.decade > 1900) {
    keys.push(`decade:${item.decade}s`);
  }

  if (item.mediaType) {
    keys.push(`type:${item.mediaType}`);
  }

  if (item.lang) {
    keys.push(`lang:${item.lang.toLowerCase()}`);
  }

  return keys;
}

/**
 * Calculates effective signal weight with exponential time decay.
 * Signal weights:
 * - watched: +1.5
 * - Completed: (rating - 5.5) / 4.5 (or +1.0 if unrated)
 * - like / Plan to Watch: +0.7
 * - Watching: +0.6
 * - never / not-interested: -1.5 (permanent)
 * - pass: -0.25 (14-day half-life decay)
 * - impression_fatigue: -0.05 (14-day decay)
 * All other signals decay with exp(-Δdays / 45).
 */
export function calculateSignalWeight(
  signal: UserInteractionSignal,
  now: Date = new Date()
): number {
  let baseWeight = 0;
  let isPermanent = false;
  let decayTau = 45; // Default tau: 45 days

  if (signal.type === "swipe") {
    switch (signal.action) {
      case "watched":
        baseWeight = 1.5;
        break;
      case "like":
        baseWeight = 0.7;
        break;
      case "pass":
        baseWeight = -0.25;
        decayTau = 14;
        break;
      case "never":
        baseWeight = -1.5;
        isPermanent = true;
        break;
      case "impression_fatigue":
        baseWeight = -0.05;
        decayTau = 14;
        break;
      default:
        baseWeight = 0;
    }
  } else if (signal.type === "watchlist") {
    const isNotInterested = signal.tags?.includes("not-interested");
    if (signal.status === "Dropped" || isNotInterested) {
      baseWeight = -1.5;
      isPermanent = true;
    } else if (signal.status === "Completed") {
      if (signal.rating != null && signal.rating >= 1 && signal.rating <= 10) {
        baseWeight = (signal.rating - 5.5) / 4.5;
      } else {
        baseWeight = 1.0;
      }
    } else if (signal.status === "Plan to Watch") {
      baseWeight = 0.7;
    } else if (signal.status === "Watching") {
      baseWeight = 0.6;
    }
  }

  if (baseWeight === 0) return 0;
  if (isPermanent) return baseWeight;

  const diffMs = Math.max(0, now.getTime() - new Date(signal.timestamp).getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const decay = Math.exp(-diffDays / decayTau);

  return baseWeight * decay;
}

/**
 * Builds user taste vector (sparse feature -> weight map) from interaction history.
 */
export function buildUserTasteVector(
  signals: UserInteractionSignal[],
  now: Date = new Date()
): { weights: Record<string, number>; signalCount: number } {
  const weights: Record<string, number> = {};
  let validSignalCount = 0;

  for (const signal of signals) {
    const weight = calculateSignalWeight(signal, now);
    if (weight === 0) continue;
    validSignalCount++;

    const keys = extractFeatureKeys(signal.features);
    for (const key of keys) {
      weights[key] = (weights[key] ?? 0) + weight;
    }
  }

  return { weights, signalCount: validSignalCount };
}

/**
 * Computes quality prior from vote_average and popularity (~0.15 weight in shrinkage blend).
 * vote_average is 0-10 -> normalized to [0, 1]
 * popularity is log-scaled to [0, 1]
 */
export function calculateQualityPrior(voteAverage?: number, popularity?: number): number {
  const voteNorm = Math.min(1, Math.max(0, (voteAverage ?? 0) / 10));
  const popNorm = Math.min(1, Math.max(0, Math.log10(Math.max(1, popularity ?? 0)) / 3));
  return 0.7 * voteNorm + 0.3 * popNorm;
}

/**
 * Scores a candidate item against user taste vector with cold-start shrinkage.
 * final = (n / (n + k)) * personal + (k / (n + k)) * qualityPrior, where k ≈ 15.
 */
export function scoreCandidate(
  features: ItemFeatures,
  userWeights: Record<string, number>,
  signalCount: number,
  k: number = 15
): {
  finalScore: number;
  personalScore: number;
  qualityPrior: number;
  matchFeatures: string[];
} {
  const keys = extractFeatureKeys(features);
  let dotProduct = 0;
  const matchedFeatures: { key: string; weight: number }[] = [];

  for (const key of keys) {
    const w = userWeights[key];
    if (w !== undefined) {
      dotProduct += w;
      if (w > 0) {
        matchedFeatures.push({ key, weight: w });
      }
    }
  }

  // Tanh mapped personal score into (0, 1) range
  const personalScore = (Math.tanh(dotProduct / 3) + 1) / 2;
  const qualityPrior = calculateQualityPrior(features.voteAverage, features.popularity);

  const shrinkage = signalCount / (signalCount + k);
  const finalScore = shrinkage * personalScore + (1 - shrinkage) * qualityPrior;

  // Sort matched features by weight descending for explainability
  matchedFeatures.sort((a, b) => b.weight - a.weight);
  let matchFeatures = matchedFeatures.slice(0, 3).map((m) => {
    const idx = m.key.indexOf(":");
    return idx >= 0 ? m.key.slice(idx + 1) : m.key;
  });

  // Cold start fallback: show top genres
  if (matchFeatures.length === 0 && features.genreNames && features.genreNames.length > 0) {
    matchFeatures = features.genreNames.slice(0, 2).map((g) => g.toLowerCase());
  }

  return {
    finalScore,
    personalScore,
    qualityPrior,
    matchFeatures,
  };
}

/**
 * Computes Jaccard similarity between two items based on genres + keywords.
 */
export function jaccardSimilarity(a: ItemFeatures, b: ItemFeatures): number {
  const setA = new Set<string>();
  const setB = new Set<string>();

  a.genreNames?.forEach((g) => setA.add(`g:${g.toLowerCase()}`));
  a.keywords?.forEach((k) => setA.add(`k:${k.toLowerCase()}`));

  b.genreNames?.forEach((g) => setB.add(`g:${g.toLowerCase()}`));
  b.keywords?.forEach((k) => setB.add(`k:${k.toLowerCase()}`));

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Maximal Marginal Relevance (MMR) reordering to prevent genre monoculture.
 * Greedy: argmax [ λ * score_i - (1 - λ) * max_{j in S} Sim(i, j) ], λ = 0.7
 */
export function mmrReorder(
  candidates: ScoredCandidate[],
  lambda: number = 0.7,
  topK: number = 30
): ScoredCandidate[] {
  if (candidates.length <= 1) return [...candidates];

  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const selected: ScoredCandidate[] = [];
  const remaining = [...pool];

  // Pick the highest scoring candidate first
  const first = remaining.shift();
  if (first) selected.push(first);

  const targetCount = Math.min(topK, candidates.length);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmrScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let maxSim = 0;

      for (const sel of selected) {
        if (candidate.features && sel.features) {
          const sim = jaccardSimilarity(candidate.features, sel.features);
          if (sim > maxSim) maxSim = sim;
        }
      }

      const mmrScore = lambda * candidate.score - (1 - lambda) * maxSim;
      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  // Append any remainder after the topK MMR selections
  return [...selected, ...remaining];
}

/**
 * ε-greedy exploration injection:
 * ~1 in 8 slots swaps in an explore card from the lower-scored tail.
 */
export function applyEpsilonGreedy(
  items: ScoredCandidate[],
  interval: number = 8
): ScoredCandidate[] {
  if (items.length <= interval) return items;

  const result = [...items];
  const tailStart = Math.min(result.length - 1, Math.floor(result.length * 0.65));

  for (let slot = interval - 1; slot < result.length - 1; slot += interval) {
    if (tailStart > slot && tailStart < result.length) {
      // Pick a random card from the lower tail
      const tailIdx =
        tailStart + Math.floor(Math.random() * (result.length - tailStart));
      // Swap card from tail into current slot
      const [exploreCard] = result.splice(tailIdx, 1);
      result.splice(slot, 0, exploreCard);
    }
  }

  return result;
}
