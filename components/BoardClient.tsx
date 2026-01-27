"use client";

import { useMemo, useState } from "react";
import CardModal from "./CardModal";

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
  boardSlug,
  cards,
}: {
  boardTitle: string;
  boardSlug: string;
  cards: Card[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId]
  );

  return (
    <main className="p-8">
      <h1 className="text-4xl font-bold">{boardTitle}</h1>
      <p className="mt-2 text-gray-600">/{boardSlug}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedId(card.id)}
            className="text-left rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            {card.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.thumbnail_url}
                alt={card.title ?? "Card"}
                className="h-40 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="h-40 w-full rounded-xl bg-gray-100" />
            )}

            <div className="mt-3">
              <h2 className="font-semibold line-clamp-2">
                {card.title ?? card.url}
              </h2>
              {card.creator_note ? (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                  {card.creator_note}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <CardModal card={selectedCard} onClose={() => setSelectedId(null)} />
    </main>
  );
}


