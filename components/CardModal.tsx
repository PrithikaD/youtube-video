"use client";

import { useEffect } from "react";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "../lib/youtube";

type Card = {
  id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  creator_note: string | null;
  source_type?: "web" | "youtube" | string | null;
  youtube_video_id?: string | null;
  youtube_timestamp?: number | null;
};

export default function CardModal({
  card,
  onClose,
}: {
  card: Card | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  if (!card) return null;

  const videoId = card.youtube_video_id ?? getYouTubeVideoId(card.url);
  const start = card.youtube_timestamp ?? 0;
  const isYouTube = Boolean(videoId);

  const embedSrc = isYouTube
    ? getYouTubeEmbedUrl({
        videoId: videoId!,
        startSeconds: start,
        autoplay: false,
        muted: false,
      })
    : "";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(1100px,95vw)] h-[min(700px,90vh)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {card.title ?? "Untitled"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid h-[calc(100%-52px)] grid-cols-1 lg:grid-cols-2">
          {/* Left: Embedded content */}
          <div className="border-b lg:border-b-0 lg:border-r p-3">
            {isYouTube ? (
              <iframe
                className="h-full w-full rounded-xl"
                src={embedSrc}
                title="YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl bg-gray-50 p-6">
                <div className="text-lg font-semibold">Open link</div>
                <div className="text-sm text-gray-600">
                  Non-YouTube embeds are tricky (CORS/iframes). For MVP, we open
                  it in a new tab.
                </div>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-black px-4 py-2 text-white"
                >
                  Open in new tab
                </a>
              </div>
            )}
          </div>

          {/* Right: Notes */}
          <div className="p-5 overflow-auto">
            <h3 className="text-lg font-semibold">Creator notes</h3>
            <div className="mt-3 whitespace-pre-wrap text-gray-800">
              {card.creator_note ? card.creator_note : "No notes yet."}
            </div>

            {/* Later: comments + connections */}
            <div className="mt-8 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              Next: invite-gated comments + pending/approved connections will go
              here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
