"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowserClient";

import {
  getYouTubeStartSeconds,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
} from "../../lib/youtube";
import { slugify } from "../../lib/slug";
import YouTubeEmbed from "../../components/YouTubeEmbed";

type Board = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
};

type CaptureClientProps = {
  userId: string;
  profileName: string | null;
  profileAvatarUrl: string | null;
};

export default function CaptureClient({
  userId,
  profileName,
  profileAvatarUrl,
}: CaptureClientProps) {
  const supabaseClient = supabase!;
  const searchParams = useSearchParams();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [useInbox, setUseInbox] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"error" | "success" | null>(
    null
  );
  const [lastSavedBoardSlug, setLastSavedBoardSlug] = useState<string | null>(
    null
  );

  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    searchParams.get("thumbnail") ?? ""
  );
  const [note, setNote] = useState(searchParams.get("note") ?? "");

  const videoId = getYouTubeVideoId(url.trim());
  const resolvedThumbnail =
    thumbnailUrl.trim() || (videoId ? getYouTubeThumbnailUrl(videoId) : "");

  useEffect(() => {
    async function loadBoards() {
      setLoadingBoards(true);
      const { data, error } = await supabaseClient
        .from("boards")
        .select("id,title,slug,is_public")
        .eq("creator_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus(error.message);
        setStatusKind("error");
        setLoadingBoards(false);
        return;
      }

      const list = data ?? [];
      setBoards(list);
      setSelectedBoardId((prev) => prev || list[0]?.id || "");
      if (list.length === 0) {
        setUseInbox(true);
      }
      setLoadingBoards(false);
    }

    loadBoards();
  }, [userId]);

  async function ensureInboxBoard() {
    const existing = boards.find((board) => board.slug === "inbox");
    if (existing) return existing.id;

    const { data: inbox, error: inboxError } = await supabaseClient
      .from("boards")
      .select("id,deleted_at")
      .eq("creator_id", userId)
      .eq("slug", "inbox")
      .maybeSingle();

    if (inboxError) {
      setStatus(inboxError.message);
      setStatusKind("error");
      return null;
    }

    if (inbox?.id) {
      if (inbox.deleted_at) {
        const { error: restoreError } = await supabaseClient
          .from("boards")
          .update({ deleted_at: null })
          .eq("id", inbox.id);
        if (restoreError) {
          setStatus(restoreError.message);
          setStatusKind("error");
          return null;
        }
      }
      await refreshBoards();
      return inbox.id;
    }

    const title = "Inbox";
    const slug = slugify(title);

    const { data, error } = await supabaseClient
      .from("boards")
      .insert({
        creator_id: userId,
        title,
        slug,
        description: "Auto-created for quick saves",
        is_public: false,
      })
      .select("id,slug")
      .single();

    if (error) {
      setStatus(error.message);
      setStatusKind("error");
      return null;
    }

    await refreshBoards();
    return data?.id ?? null;
  }

  async function refreshBoards() {
    const { data, error } = await supabaseClient
      .from("boards")
      .select("id,title,slug,is_public")
      .eq("creator_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      setStatusKind("error");
      return;
    }

    setBoards(data ?? []);
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setStatusKind(null);
    setSaving(true);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setStatus("Please provide a URL.");
      setStatusKind("error");
      setSaving(false);
      return;
    }

    let boardId = selectedBoardId;
    if (useInbox || !boardId) {
      const inboxId = await ensureInboxBoard();
      if (!inboxId) {
        setSaving(false);
        return;
      }
      boardId = inboxId;
    }

    const resolvedVideoId = getYouTubeVideoId(trimmedUrl);
    const resolvedTimestamp = resolvedVideoId
      ? getYouTubeStartSeconds(trimmedUrl)
      : null;

    const { error } = await supabaseClient.from("cards").insert({
      board_id: boardId,
      url: trimmedUrl,
      title: title.trim() ? title.trim() : null,
      creator_note: note.trim() ? note.trim() : null,
      thumbnail_url: resolvedThumbnail || null,
      source_type: resolvedVideoId ? "youtube" : "web",
      youtube_video_id: resolvedVideoId,
      youtube_timestamp: resolvedTimestamp,
    });

    if (error) {
      setStatus(error.message);
      setStatusKind("error");
      setSaving(false);
      return;
    }

    const boardSlug =
      boards.find((board) => board.id === boardId)?.slug ?? "";
    setLastSavedBoardSlug(boardSlug || null);

    setStatus("Saved to your board.");
    setStatusKind("success");
    setSaving(false);
  }

  return (
    <main className="p-8 max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
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
            {profileName || "Dashboard"}
          </div>
        </Link>
        <Link href="/dashboard" className="text-sm underline">
          Edit dashboard
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Capture a link</h1>
        <p className="text-gray-600">
          Review what we found, add notes, and choose where to save it.
        </p>
        {status ? (
          <div
            className={`text-sm ${
              statusKind === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {status}
          </div>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Preview</h2>
        {videoId ? (
          <YouTubeEmbed
            url={url}
            videoId={videoId}
            thumbnailUrl={resolvedThumbnail}
            className="h-56 w-full max-w-2xl rounded-2xl border"
          />
        ) : resolvedThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedThumbnail}
            alt=""
            className="h-56 w-full max-w-2xl rounded-2xl border object-cover"
          />
        ) : (
          <div className="h-56 w-full max-w-2xl rounded-2xl border bg-gray-100" />
        )}
      </section>

      <form onSubmit={saveCard} className="space-y-4">
        <section className="space-y-2">
          <label className="block">
            <span className="text-sm text-gray-700">URL</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Title</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Thumbnail URL</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="Optional thumbnail URL"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Notes</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your notes"
              rows={4}
            />
          </label>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Save destination</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useInbox}
              onChange={(e) => setUseInbox(e.target.checked)}
            />
            Save to Inbox (freestanding)
          </label>
          <select
            className="border rounded-xl px-3 py-2 w-full"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
            disabled={useInbox || loadingBoards}
          >
            <option value="">
              {loadingBoards ? "Loading boards..." : "Select a board"}
            </option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </section>

        <div className="flex items-center gap-3">
          <button
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {lastSavedBoardSlug ? (
            <a
              className="text-sm underline"
              href={`/board/${encodeURIComponent(lastSavedBoardSlug)}`}
              target="_blank"
              rel="noreferrer"
            >
              View board {"->"}
            </a>
          ) : null}
        </div>
      </form>
    </main>
  );
}
