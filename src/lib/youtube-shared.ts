/**
 * Client-safe constants and helpers for the YouTube integration.
 * Kept separate from `youtube.ts` so client components can import the URL
 * helpers without pulling in the Node-only `googleapis` package.
 */

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeShortUrl(id: string): string {
  return `https://www.youtube.com/shorts/${id}`;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
