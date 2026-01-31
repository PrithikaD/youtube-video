"use client";

import { useMemo, useState } from "react";
import {
  getYouTubeEmbedUrl,
  getYouTubeStartSeconds,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
} from "../lib/youtube";

export default function YouTubeEmbed({
  url,
  title,
  videoId: videoIdProp,
  startSeconds: startSecondsProp,
  thumbnailUrl: thumbnailUrlProp,
  className = "h-40 w-full rounded-xl",
}: {
  url: string;
  title?: string | null;
  videoId?: string | null;
  startSeconds?: number | null;
  thumbnailUrl?: string | null;
  className?: string;
}) {
  const videoId = useMemo(
    () => videoIdProp ?? getYouTubeVideoId(url),
    [url, videoIdProp]
  );
  const startSeconds = useMemo(() => {
    if (typeof startSecondsProp === "number") return startSecondsProp;
    return getYouTubeStartSeconds(url) ?? 0;
  }, [startSecondsProp, url]);

  const thumbnailUrl = useMemo(() => {
    if (thumbnailUrlProp) return thumbnailUrlProp;
    if (!videoId) return null;
    return getYouTubeThumbnailUrl(videoId);
  }, [thumbnailUrlProp, videoId]);

  const [playing, setPlaying] = useState(false);

  if (!videoId) return null;

  const embedSrc = getYouTubeEmbedUrl({
    videoId,
    startSeconds,
    autoplay: true,
  });

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedSrc}
          title={title ?? "YouTube player"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlaying(true);
          }}
          className="absolute inset-0"
          aria-label="Play YouTube video"
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title ?? "YouTube thumbnail"}
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/90 shadow">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 translate-x-0.5 text-black"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

