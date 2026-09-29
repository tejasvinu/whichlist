const TMDB_BASE = "https://api.themoviedb.org/3";

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not configured");
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`TMDB error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface TmdbSearchResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids?: number[];
  popularity?: number;
  vote_count?: number;
  original_language?: string;
}

export interface TmdbMultiSearchResponse {
  results: TmdbSearchResult[];
}

export interface TmdbTrendingResponse {
  page?: number;
  results: TmdbSearchResult[];
  total_pages?: number;
  total_results?: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: TmdbGenre[];
  popularity?: number;
  vote_average?: number;
  original_language?: string;
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
  keywords?: { keywords: TmdbKeyword[] };
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  episode_run_time: number[];
  genres: TmdbGenre[];
  popularity?: number;
  vote_average?: number;
  original_language?: string;
  created_by?: { id: number; name: string }[];
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
  keywords?: { results: TmdbKeyword[] };
}

let cachedGenreMap: Map<number, string> | null = null;

export async function getGenreMap(): Promise<Map<number, string>> {
  if (cachedGenreMap) return cachedGenreMap;
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list"),
      tmdbFetch<{ genres: TmdbGenre[] }>("/genre/tv/list"),
    ]);
    const map = new Map<number, string>();
    movieGenres.genres?.forEach((g) => map.set(g.id, g.name));
    tvGenres.genres?.forEach((g) => map.set(g.id, g.name));
    cachedGenreMap = map;
    return map;
  } catch {
    return cachedGenreMap ?? new Map<number, string>();
  }
}

export function posterUrl(path: string | null, size: "w342" | "w500" | "original" = "w500") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getTitle(item: TmdbSearchResult) {
  return item.title ?? item.name ?? "Untitled";
}

export function getReleaseYear(item: { release_date?: string; first_air_date?: string }) {
  const date = item.release_date ?? item.first_air_date;
  if (!date) return null;
  return parseInt(date.slice(0, 4), 10);
}

export async function searchMulti(query: string) {
  return tmdbFetch<TmdbMultiSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
  });
}

export async function getTrending(page: number = 1) {
  return tmdbFetch<TmdbTrendingResponse>("/trending/all/week", {
    page: page.toString(),
  });
}

export async function getRecommendations(type: "movie" | "tv", id: number, page: number = 1) {
  return tmdbFetch<TmdbTrendingResponse>(`/${type}/${id}/recommendations`, {
    page: page.toString(),
  });
}

export async function getMovieDetails(id: number) {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, {
    append_to_response: "credits,videos,keywords",
  });
}

export async function getTvDetails(id: number) {
  return tmdbFetch<TmdbTvDetails>(`/tv/${id}`, {
    append_to_response: "credits,videos,keywords",
  });
}

export function getTrailerUrl(videos?: { results: TmdbVideo[] }) {
  const trailer = videos?.results.find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}
