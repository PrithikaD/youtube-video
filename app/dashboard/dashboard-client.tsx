"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";

type Board = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
};

type Card = {
  id: string;
  board_id: string;
  url: string;
  creator_note: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

export default function DashboardClient({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");

  const [boardTitle, setBoardTitle] = useState("");
  const [boardSlug, setBoardSlug] = useState("");

  const [cards, setCards] = useState<Card[]>([]);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const [status, setStatus] = useState<string | null>(null);

  async function loadBoards() {
    const { data, error } = await supabase
      .from("boards")
      .select("id,title,slug,is_public")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }
    setBoards(data ?? []);
    if (!selectedBoardId && data?.[0]?.id) setSelectedBoardId(data[0].id);
  }

  async function loadCards(boardId: string) {
    const { data, error } = await supabase
      .from("cards")
      .select("id,board_id,url,creator_note,thumbnail_url,created_at")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }
    setCards(data ?? []);
  }

  useEffect(() => {
    loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBoardId) loadCards(selectedBoardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoardId]);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!boardTitle.trim() || !boardSlug.trim()) {
      setStatus("Please provide a title and a slug.");
      return;
    }

    const { data, error } = await supabase
      .from("boards")
      .insert({
        creator_id: userId,
        title: boardTitle.trim(),
        slug: boardSlug.trim(),
        is_public: true,
      })
      .select("id,title,slug,is_public")
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }

    setBoardTitle("");
    setBoardSlug("");
    if (data) {
      setBoards((prev) => [data, ...prev]);
      setSelectedBoardId(data.id);
    } else {
      await loadBoards();
    }
    setStatus("Board created ✅");
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!selectedBoardId) {
      setStatus("Select a board first.");
      return;
    }
    if (!url.trim()) {
      setStatus("Please provide a URL.");
      return;
    }

    const { error } = await supabase.from("cards").insert({
      board_id: selectedBoardId,
      url: url.trim(),
      creator_note: note.trim() ? note.trim() : null,
      thumbnail_url: thumbnailUrl.trim() ? thumbnailUrl.trim() : null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setUrl("");
    setNote("");
    setThumbnailUrl("");
    await loadCards(selectedBoardId);
    setStatus("Card added ✅");
  }

  return (
    <main className="p-8 max-w-3xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Create boards and add cards.</p>
        {status ? <div className="text-sm text-red-600">{status}</div> : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your boards</h2>

        <div className="flex gap-2 items-center">
          <select
            className="border rounded-xl px-3 py-2"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
          >
            <option value="">Select a board…</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.slug})
              </option>
            ))}
          </select>

          {selectedBoardId ? (
            <a
              className="text-sm underline"
              href={`/board/${boards.find((b) => b.id === selectedBoardId)?.slug ?? ""}`}
              target="_blank"
              rel="noreferrer"
            >
              View public page →
            </a>
          ) : null}
        </div>

        <form onSubmit={createBoard} className="flex gap-2 flex-wrap">
          <input
            className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
            placeholder="Board title"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
          />
          <input
            className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
            placeholder="slug (e.g. pablo-test)"
            value={boardSlug}
            onChange={(e) => setBoardSlug(e.target.value)}
          />
          <button className="rounded-xl bg-black text-white px-4 py-2">
            Create board
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Add a card</h2>

        <form onSubmit={addCard} className="space-y-2">
          <input
            className="border rounded-xl px-3 py-2 w-full"
            placeholder="URL (e.g. https://youtube.com/watch?v=...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="border rounded-xl px-3 py-2 w-full"
            placeholder="Thumbnail URL (optional)"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
          />
          <textarea
            className="border rounded-xl px-3 py-2 w-full"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="rounded-xl bg-black text-white px-4 py-2">
            Add card
          </button>
        </form>

        <div className="space-y-2">
          <h3 className="font-semibold">Cards</h3>
          {cards.length === 0 ? (
            <p className="text-gray-600 text-sm">No cards yet.</p>
          ) : (
            <ul className="space-y-2">
              {cards.map((c) => (
                <li key={c.id} className="border rounded-2xl p-3">
                  <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                    {c.url}
                  </a>
                  {c.creator_note ? (
                    <div className="text-sm text-gray-700 mt-1">{c.creator_note}</div>
                  ) : null}
                  {c.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnail_url}
                      alt=""
                      className="mt-2 w-full max-w-sm rounded-xl border"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
