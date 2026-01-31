export function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host.endsWith("youtube.com")) {
      // https://www.youtube.com/watch?v=VIDEO_ID
      const v = u.searchParams.get("v");
      if (v) return v;

      // https://www.youtube.com/shorts/VIDEO_ID
      // https://www.youtube.com/embed/VIDEO_ID
      // https://www.youtube.com/live/VIDEO_ID
      const parts = u.pathname.split("/").filter(Boolean);
      const [kind, id] = parts;
      if (
        (kind === "shorts" || kind === "embed" || kind === "live") &&
        typeof id === "string" &&
        id.length > 0
      ) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseYouTubeTimeToSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // "90" or "90s"
  const simple = trimmed.replace(/s$/i, "");
  if (/^\d+$/.test(simple)) return Number(simple);

  // "1h2m3s" / "2m10s"
  const m = trimmed.match(
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i
  );
  if (!m) return null;

  const h = m[1] ? Number(m[1]) : 0;
  const min = m[2] ? Number(m[2]) : 0;
  const sec = m[3] ? Number(m[3]) : 0;
  const total = h * 3600 + min * 60 + sec;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

export function getYouTubeStartSeconds(url: string): number | null {
  try {
    const u = new URL(url);
    const t =
      u.searchParams.get("t") ??
      u.searchParams.get("start") ??
      u.searchParams.get("time_continue");
    if (!t) return null;
    return parseYouTubeTimeToSeconds(t);
  } catch {
    return null;
  }
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  // "hqdefault" is reliable; "maxresdefault" often 404s for some videos.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(opts: {
  videoId: string;
  startSeconds?: number;
  autoplay?: boolean;
}): string {
  const start = Math.max(0, Math.floor(opts.startSeconds ?? 0));
  const autoplay = opts.autoplay ? 1 : 0;
  const params = new URLSearchParams();
  if (start) params.set("start", String(start));
  if (autoplay) params.set("autoplay", String(autoplay));
  params.set("rel", "0");
  return `https://www.youtube-nocookie.com/embed/${opts.videoId}?${params.toString()}`;
}

