export const WATCH_STATUSES = [
  "Plan to Watch",
  "Watching",
  "Completed",
  "Dropped",
] as const;

export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const MEDIA_TYPES = ["movie", "tv"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const SORT_OPTIONS = [
  { value: "dateAdded", label: "Date Added" },
  { value: "rating", label: "Highest Rated" },
  { value: "releaseYear", label: "Release Year" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
