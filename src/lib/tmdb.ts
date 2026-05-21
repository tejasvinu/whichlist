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
}

export interface TmdbMultiSearchResponse {
  results: TmdbSearchResult[];
}

export interface TmdbTrendingResponse {
  results: TmdbSearchResult[];
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

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: TmdbGenre[];
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
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
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
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

export async function getTrending() {
  return tmdbFetch<TmdbTrendingResponse>("/trending/all/week");
}

export async function getMovieDetails(id: number) {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, {
    append_to_response: "credits,videos",
  });
}

export async function getTvDetails(id: number) {
  return tmdbFetch<TmdbTvDetails>(`/tv/${id}`, {
    append_to_response: "credits,videos",
  });
}

export function getTrailerUrl(videos?: { results: TmdbVideo[] }) {
  const trailer = videos?.results.find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}
