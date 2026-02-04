"use client";

import { useMemo, useState } from "react";
import CardModal from "./CardModal";
import YouTubeEmbed from "./YouTubeEmbed";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "../lib/youtube";

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

export default function BoardClient({
  boardTitle,
  boardDescription,
  cards,
  profileName,
  profileAvatarUrl,
}: {
  boardTitle: string;
  boardDescription?: string | null;
  cards: Card[];
  profileName?: string | null;
  profileAvatarUrl?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId]
  );

  return (
    <main className="p-8">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
          {profileAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileAvatarUrl}
              alt={profileName ?? "Profile"}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="text-sm text-gray-700">
          {profileName ?? "Unknown"}
        </div>
      </div>

      <h1 className="mt-3 text-4xl font-bold">{boardTitle}</h1>
      {boardDescription ? (
        <p className="mt-2 text-gray-600">{boardDescription}</p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const videoId = card.youtube_video_id ?? getYouTubeVideoId(card.url);
          const isYouTube = Boolean(videoId);
          const thumbnailUrl =
            card.thumbnail_url ?? (videoId ? getYouTubeThumbnailUrl(videoId) : null);

          if (!isYouTube) {
            return (
              <button
                key={card.id}
                onClick={() => setSelectedId(card.id)}
                className="text-left rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt={card.title ?? "Card"}
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-40 w-full rounded-xl bg-gray-100" />
                )}

                <div className="mt-3">
                  <h2 className="font-semibold line-clamp-2">
                    {card.title ?? "Untitled"}
                  </h2>
                  {card.creator_note ? (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                      {card.creator_note}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          }

          return (
            <div
              key={card.id}
              className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <YouTubeEmbed
                url={card.url}
                title={card.title}
                videoId={videoId}
                startSeconds={card.youtube_timestamp ?? 0}
                thumbnailUrl={thumbnailUrl}
                className="h-40 w-full rounded-xl"
              />

              <button
                onClick={() => setSelectedId(card.id)}
                className="mt-3 w-full text-left"
              >
                <h2 className="font-semibold line-clamp-2">
                  {card.title ?? "Untitled"}
                </h2>
                {card.creator_note ? (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                    {card.creator_note}
                  </p>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <CardModal card={selectedCard} onClose={() => setSelectedId(null)} />
    </main>
  );
}
