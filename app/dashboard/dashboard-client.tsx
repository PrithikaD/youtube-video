"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";
import YouTubeEmbed from "../../components/YouTubeEmbed";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "../../lib/youtube";
import { slugify } from "../../lib/slug";

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
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");

  const [boardTitle, setBoardTitle] = useState("");
  const [boardSlug, setBoardSlug] = useState("");

  const [cards, setCards] = useState<Card[]>([]);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const [status, setStatus] = useState<string | null>(null);

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setStatus(error.message);
      return;
    }
    if (data) {
      setProfileName(data.full_name ?? "");
      setProfileAvatarUrl(data.avatar_url ?? null);
    }
  }

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
    loadProfile();
    loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBoardId) loadCards(selectedBoardId);
  }, [selectedBoardId]);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const title = boardTitle.trim();
    const slug = slugify(boardSlug);

    if (!title || !slug) {
      setStatus("Please provide a title and a slug.");
      return;
    }

    const { data, error } = await supabase
      .from("boards")
      .insert({
        creator_id: userId,
        title,
        slug,
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
      thumbnail_url: null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setUrl("");
    setNote("");
    await loadCards(selectedBoardId);
    setStatus("Card added ✅");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    let avatarUrl = profileAvatarUrl;

    if (profileFile) {
      const ext = profileFile.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, profileFile, { upsert: true });

      if (uploadError) {
        setStatus(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = data.publicUrl;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: profileName.trim() ? profileName.trim() : null,
      avatar_url: avatarUrl ?? null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setProfileFile(null);
    setStatus("Profile saved ✅");
  }

  async function deleteBoard() {
    if (!selectedBoardId) return;
    const board = boards.find((b) => b.id === selectedBoardId);
    const ok = window.confirm(
      `Delete board "${board?.title ?? "Untitled"}" and all its cards? This cannot be undone.`
    );
    if (!ok) return;
    setStatus(null);

    const { error: cardsError } = await supabase
      .from("cards")
      .delete()
      .eq("board_id", selectedBoardId);
    if (cardsError) {
      setStatus(cardsError.message);
      return;
    }

    const { error: boardError } = await supabase
      .from("boards")
      .delete()
      .eq("id", selectedBoardId);
    if (boardError) {
      setStatus(boardError.message);
      return;
    }

    setSelectedBoardId("");
    await loadBoards();
    setCards([]);
    setStatus("Board deleted ✅");
  }
  async function deleteCard(cardId: string) {
    if (!selectedBoardId) return;
    const ok = window.confirm("Delete this card? This cannot be undone.");
    if (!ok) return;
    setStatus(null);

    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadCards(selectedBoardId);
    setStatus("Card deleted ✅");
  }

  return (
    <main className="p-8 max-w-3xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="text-gray-600">Add your name and profile photo.</p>
        {status ? <div className="text-sm text-red-600">{status}</div> : null}
      </header>

      <section className="space-y-3">
        <form onSubmit={saveProfile} className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
              {profileAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileAvatarUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 space-y-2">
              <input
                className="border rounded-xl px-3 py-2 w-full"
                placeholder="Your name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                className="text-sm"
                onChange={(e) =>
                  setProfileFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
          </div>
          <button className="rounded-xl bg-black text-white px-4 py-2">
            Save profile
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your boards</h2>

        <div className="flex gap-2 items-center flex-wrap">
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
            <>
              <a
                className="text-sm underline"
                href={`/board/${encodeURIComponent(
                  boards.find((b) => b.id === selectedBoardId)?.slug ?? ""
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                View public page →
              </a>
              <button
                className="text-sm text-red-600 hover:underline"
                onClick={deleteBoard}
              >
                Delete board
              </button>
            </>
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
                <li key={c.id} className="border rounded-2xl bg-white p-3">
                  {(() => {
                    const videoId = getYouTubeVideoId(c.url);
                    const thumbnailUrl =
                      c.thumbnail_url ??
                      (videoId ? getYouTubeThumbnailUrl(videoId) : null);

                    return videoId ? (
                      <YouTubeEmbed
                        url={c.url}
                        videoId={videoId}
                        thumbnailUrl={thumbnailUrl}
                        className="h-44 w-full max-w-sm rounded-xl border"
                      />
                    ) : thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailUrl}
                        alt=""
                        className="w-full max-w-sm rounded-xl border object-cover"
                      />
                    ) : (
                      <div className="h-44 w-full max-w-sm rounded-xl border bg-gray-100" />
                    );
                  })()}

                  <div className="mt-2">
                    {c.creator_note ? (
                      <div className="text-sm text-gray-700 mt-1">
                        {c.creator_note}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <button
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => deleteCard(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
