"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowserClient";

import YouTubeEmbed from "../../components/YouTubeEmbed";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "../../lib/youtube";
import { slugify } from "../../lib/slug";

type Board = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
  description: string | null;
  deleted_at?: string | null;
};

type Card = {
  id: string;
  board_id: string;
  url: string;
  title: string | null;
  creator_note: string | null;
  thumbnail_url: string | null;
  created_at: string;
  deleted_at?: string | null;
};

export default function DashboardClient() {
  const supabaseClient = supabase!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");

  const [boardTitle, setBoardTitle] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardIsPublic, setBoardIsPublic] = useState(true);
  const [boardEditTitle, setBoardEditTitle] = useState("");
  const [boardEditDescription, setBoardEditDescription] = useState("");
  const [boardEditIsPublic, setBoardEditIsPublic] = useState(true);

  const [cards, setCards] = useState<Card[]>([]);
  const [deletedCards, setDeletedCards] = useState<Card[]>([]);
  const [showDeletedCards, setShowDeletedCards] = useState(false);
  const [url, setUrl] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardTitleTouched, setCardTitleTouched] = useState(false);
  const [note, setNote] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const statusKind = status?.includes("✅") ? "success" : "error";
  const [showTrash, setShowTrash] = useState(false);
  const [deletedBoards, setDeletedBoards] = useState<Board[]>([]);
  const [confirm, setConfirm] = useState<
    | null
    | {
        title: string;
        message: string;
        confirmLabel?: string;
        onConfirm: () => void | Promise<void>;
      }
  >(null);

  async function loadProfile(currentUserId: string) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", currentUserId)
      .maybeSingle();

    if (error) {
      setStatus(error.message);
      return;
    }
    if (data) {
      setProfileName(data.full_name ?? "");
      setProfileAvatarUrl(data.avatar_url ?? null);
    }
    setProfileLoaded(true);
  }

  async function loadBoards(currentUserId: string) {
    const { data, error } = await supabaseClient
      .from("boards")
      .select("id,title,slug,is_public,description")
      .eq("creator_id", currentUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return [];
    }
    setBoards(data ?? []);
    if (!selectedBoardId && data?.[0]?.id) setSelectedBoardId(data[0].id);
    return data ?? [];
  }

  async function loadDeletedBoards(currentUserId: string) {
    const { data, error } = await supabaseClient
      .from("boards")
      .select("id,title,slug,is_public,description,deleted_at")
      .eq("creator_id", currentUserId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return [];
    }
    setDeletedBoards(data ?? []);
    return data ?? [];
  }

  async function loadCards(boardId: string) {
    const { data, error } = await supabaseClient
      .from("cards")
      .select(
        "id,board_id,url,title,creator_note,thumbnail_url,created_at,deleted_at"
      )
      .eq("board_id", boardId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }
    setCards(data ?? []);
  }

  async function loadDeletedCards(boardId: string) {
    const { data, error } = await supabaseClient
      .from("cards")
      .select(
        "id,board_id,url,title,creator_note,thumbnail_url,created_at,deleted_at"
      )
      .eq("board_id", boardId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }
    setDeletedCards(data ?? []);
  }

  async function loadUser() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
      setStatus(error.message);
      return;
    }
    if (!data.user) {
      setStatus("Please log in again.");
      return;
    }
    setUserId(data.user.id);
  }

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
    loadBoards(userId);
  }, [userId]);

  useEffect(() => {
    if (selectedBoardId) loadCards(selectedBoardId);
  }, [selectedBoardId]);

  useEffect(() => {
    if (!showDeletedCards || !selectedBoardId) return;
    loadDeletedCards(selectedBoardId);
  }, [showDeletedCards, selectedBoardId]);

  useEffect(() => {
    if (!showTrash || !userId) return;
    loadDeletedBoards(userId);
  }, [showTrash, userId]);

  useEffect(() => {
    const board = boards.find((b) => b.id === selectedBoardId);
    setBoardEditTitle(board?.title ?? "");
    setBoardEditDescription(board?.description ?? "");
    setBoardEditIsPublic(board?.is_public ?? true);
  }, [boards, selectedBoardId]);

  useEffect(() => {
    if (url.trim()) return;
    setCardTitle("");
    setCardTitleTouched(false);
  }, [url]);

  useEffect(() => {
    let ignore = false;
    const currentUrl = url.trim();
    if (!currentUrl) return;
    if (cardTitleTouched) return;
    const videoId = getYouTubeVideoId(currentUrl);
    if (!videoId) return;

    async function fetchTitle() {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(
            currentUrl
          )}&format=json`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { title?: string };
        if (!ignore && data?.title) {
          setCardTitle(data.title);
        }
      } catch {
        // Ignore auto-title failures; user can type manually.
      }
    }

    fetchTitle();
    return () => {
      ignore = true;
    };
  }, [url, cardTitleTouched]);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const title = boardTitle.trim();
    const slug = slugify(title);
    const description = boardDescription.trim();

    if (!title || !slug) {
      setStatus("Please provide a board title.");
      return;
    }

    if (!userId) {
      setStatus("Please log in again.");
      return;
    }

    const { data, error } = await supabaseClient
      .from("boards")
      .insert({
        creator_id: userId,
        title,
        description: description ? description : null,
        slug,
        is_public: boardIsPublic,
      })
      .select("id,title,slug,is_public,description")
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }

    setBoardTitle("");
    setBoardDescription("");
    setBoardIsPublic(true);
    if (data) {
      setBoards((prev) => [data, ...prev]);
      setSelectedBoardId(data.id);
    } else if (userId) {
      await loadBoards(userId);
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

    const { error } = await supabaseClient.from("cards").insert({
      board_id: selectedBoardId,
      url: url.trim(),
      title: cardTitle.trim() ? cardTitle.trim() : null,
      creator_note: note.trim() ? note.trim() : null,
      thumbnail_url: null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setUrl("");
    setCardTitle("");
    setCardTitleTouched(false);
    setNote("");
    await loadCards(selectedBoardId);
    setStatus("Card added ✅");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setStatus("Please add your full name.");
      return;
    }
    if (!profileAvatarUrl && !profileFile) {
      setStatus("Please upload a profile photo.");
      return;
    }

    if (!userId) {
      setStatus("Please log in again.");
      return;
    }

    let avatarUrl = profileAvatarUrl;

    if (profileFile) {
      const ext = profileFile.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, profileFile, { upsert: true });

      if (uploadError) {
        setStatus(uploadError.message);
        return;
      }

      const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      avatarUrl = data.publicUrl;
    }

    const { error } = await supabaseClient.from("profiles").upsert({
      id: userId,
      full_name: trimmedName ? trimmedName : null,
      avatar_url: avatarUrl ?? null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setProfileName(trimmedName);
    setProfileAvatarUrl(avatarUrl ?? null);
    setProfileFile(null);
    setProfileLoaded(true);
    setStatus("Profile saved ✅");

    if (isOnboarding) {
      const freshBoards = await loadBoards(userId);
      const boardToOpen =
        freshBoards.find((b) => b.id === selectedBoardId) ?? freshBoards[0];
      if (boardToOpen?.slug) {
        router.push(`/board/${encodeURIComponent(boardToOpen.slug)}`);
        router.refresh();
      }
    } else {
      setIsEditingProfile(false);
    }
  }

  const isOnboarding = searchParams.get("onboarding") === "1";
  const needsProfile =
    profileLoaded &&
    (!profileName.trim() || (!profileAvatarUrl && !profileFile));
  const showProfileForm = (isOnboarding && needsProfile) || isEditingProfile;

  async function deleteBoard() {
    if (!selectedBoardId) return;
    const board = boards.find((b) => b.id === selectedBoardId);
    setConfirm({
      title: "Delete board?",
      message: `Delete board "${board?.title ?? "Untitled"}" and all its cards? This cannot be undone.`,
      confirmLabel: "Delete board",
      onConfirm: async () => {
        setConfirm(null);
        setStatus(null);
        const deletedAt = new Date().toISOString();

        const { error: cardsError } = await supabaseClient
          .from("cards")
          .update({ deleted_at: deletedAt })
          .eq("board_id", selectedBoardId);
        if (cardsError) {
          setStatus(cardsError.message);
          return;
        }

        const { error: boardError } = await supabaseClient
          .from("boards")
          .update({ deleted_at: deletedAt })
          .eq("id", selectedBoardId);
        if (boardError) {
          setStatus(boardError.message);
          return;
        }

        setSelectedBoardId("");
        if (userId) {
          await loadBoards(userId);
        }
        setCards([]);
        setStatus("Board deleted ✅");
        if (userId) {
          await loadDeletedBoards(userId);
        }
      },
    });
  }
  async function deleteCard(cardId: string) {
    if (!selectedBoardId) return;
    setConfirm({
      title: "Delete card?",
      message: "Delete this card? This cannot be undone.",
      confirmLabel: "Delete card",
      onConfirm: async () => {
        setConfirm(null);
        setStatus(null);
        const deletedAt = new Date().toISOString();

        const { error } = await supabaseClient
          .from("cards")
          .update({ deleted_at: deletedAt })
          .eq("id", cardId);
        if (error) {
          setStatus(error.message);
          return;
        }
        await loadCards(selectedBoardId);
        setStatus("Card deleted ✅");
        if (showDeletedCards) {
          await loadDeletedCards(selectedBoardId);
        }
      },
    });
  }

  async function restoreBoard(board: Board) {
    setStatus(null);
    const { error: boardError } = await supabaseClient
      .from("boards")
      .update({ deleted_at: null })
      .eq("id", board.id);
    if (boardError) {
      setStatus(boardError.message);
      return;
    }

    let cardsQuery = supabaseClient
      .from("cards")
      .update({ deleted_at: null })
      .eq("board_id", board.id);
    if (board.deleted_at) {
      cardsQuery = cardsQuery.eq("deleted_at", board.deleted_at);
    } else {
      cardsQuery = cardsQuery.not("deleted_at", "is", null);
    }

    const { error: cardsError } = await cardsQuery;
    if (cardsError) {
      setStatus(cardsError.message);
      return;
    }

    if (userId) {
      await loadBoards(userId);
      await loadDeletedBoards(userId);
    }
    setStatus("Board restored ✅");
  }

  async function restoreCard(cardId: string) {
    if (!selectedBoardId) return;
    setStatus(null);
    const { error } = await supabaseClient
      .from("cards")
      .update({ deleted_at: null })
      .eq("id", cardId);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadCards(selectedBoardId);
    if (showDeletedCards) {
      await loadDeletedCards(selectedBoardId);
    }
    setStatus("Card restored ✅");
  }


  async function updateCardTitle(cardId: string, rawTitle: string) {
    const title = rawTitle.trim();
    const { error } = await supabaseClient
      .from("cards")
      .update({ title: title ? title : null })
      .eq("id", cardId);
    if (error) {
      setStatus(error.message);
      return;
    }
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, title: title ? title : null } : card
      )
    );
    setStatus("Card title saved ✅");
  }

  async function updateCardNote(cardId: string, rawNote: string) {
    const creatorNote = rawNote.trim();
    const { error } = await supabaseClient
      .from("cards")
      .update({ creator_note: creatorNote ? creatorNote : null })
      .eq("id", cardId);
    if (error) {
      setStatus(error.message);
      return;
    }
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? { ...card, creator_note: creatorNote ? creatorNote : null }
          : card
      )
    );
    setStatus("Card description saved ✅");
  }

  async function updateBoardDetails(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!selectedBoardId) {
      setStatus("Select a board first.");
      return;
    }

    const title = boardEditTitle.trim();
    const description = boardEditDescription.trim();
    if (!title) {
      setStatus("Board title cannot be empty.");
      return;
    }

    const { error } = await supabaseClient
      .from("boards")
      .update({
        title,
        description: description ? description : null,
        is_public: boardEditIsPublic,
      })
      .eq("id", selectedBoardId);
    if (error) {
      setStatus(error.message);
      return;
    }

    setBoards((prev) =>
      prev.map((board) =>
        board.id === selectedBoardId
          ? {
              ...board,
              title,
              description: description ? description : null,
              is_public: boardEditIsPublic,
            }
          : board
      )
    );
    setStatus("Board updated ✅");
  }

  async function createInvite() {
    if (!selectedBoardId) {
      setInviteStatus("Select a board first.");
      return;
    }

    setInviteStatus(null);
    const selectedBoard = boards.find((board) => board.id === selectedBoardId);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    if (selectedBoard?.is_public && selectedBoard.slug) {
      const link = `${origin}/board/${encodeURIComponent(selectedBoard.slug)}`;
      setInviteLink(link);
      setInviteStatus("Public board link created.");
      return;
    }

    const response = await fetch("/api/boards/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: selectedBoardId }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setInviteStatus(payload?.error ?? "Unable to create invite link.");
      return;
    }

    const token = payload?.token as string | undefined;
    if (!token) {
      setInviteStatus("Invite token missing.");
      return;
    }
    const link = `${origin}/invite/${encodeURIComponent(token)}`;
    setInviteLink(link);
    setInviteStatus("Invite link created.");
  }

  return (
    <main className="p-8 max-w-3xl space-y-10">
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{confirm.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{confirm.message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-white"
                onClick={() => confirm.onConfirm()}
              >
                {confirm.confirmLabel ?? "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showProfileForm ? (
        <section className="space-y-3">
          <header className="space-y-1">
            <h1 className="text-3xl font-bold">Complete your profile</h1>
            <p className="text-gray-600">
              Add your name and a profile photo to continue.
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
                  onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl bg-black text-white px-4 py-2">
                Save profile
              </button>
              {!isOnboarding ? (
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2"
                  onClick={() => setIsEditingProfile(false)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {isOnboarding && needsProfile ? null : (
        <section className="space-y-3">
        {status && !showProfileForm ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              statusKind === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {status}
          </div>
        ) : null}
        {!showProfileForm && profileLoaded ? (
          <div className="flex items-center gap-3">
            <Link href="/profile" className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                {profileAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileAvatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="text-sm text-gray-700">
                {profileName || "Unnamed"}
              </div>
            </Link>
            <button
              type="button"
              className="ml-auto rounded-xl border px-3 py-1.5 text-sm"
              onClick={() => setIsEditingProfile(true)}
            >
              Edit profile
            </button>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Your boards</h2>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setShowTrash((prev) => !prev)}
          >
            {showTrash ? "Hide trash" : "Show trash"}
          </button>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="border rounded-xl px-3 py-2"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
          >
            <option value="">Select a board…</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
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
                {boards.find((b) => b.id === selectedBoardId)?.is_public
                  ? "View public page →"
                  : "View private page →"}
              </a>
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={deleteBoard}
              >
                Delete board
              </button>
            </>
          ) : null}
        </div>

        {selectedBoardId ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-1.5 text-sm"
              onClick={createInvite}
            >
              Create invite link
            </button>
            {inviteStatus ? (
              <div className="text-sm text-gray-600">{inviteStatus}</div>
            ) : null}
            {inviteLink ? (
              <input
                className="border rounded-xl px-3 py-1.5 text-sm flex-1 min-w-[220px]"
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
              />
            ) : null}
          </div>
        ) : null}

        {selectedBoardId ? (
          <form onSubmit={updateBoardDetails} className="flex gap-2 flex-wrap">
            <input
              className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
              placeholder="Board title"
              value={boardEditTitle}
              onChange={(e) => setBoardEditTitle(e.target.value)}
            />
            <input
              className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
              placeholder="Description (optional)"
              value={boardEditDescription}
              onChange={(e) => setBoardEditDescription(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={boardEditIsPublic}
                onChange={(e) => setBoardEditIsPublic(e.target.checked)}
              />
              Public
            </label>
            <button className="rounded-xl bg-black text-white px-4 py-2">
              Save changes
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-2"
              onClick={() => {
                const board = boards.find((b) => b.id === selectedBoardId);
                setBoardEditTitle(board?.title ?? "");
                setBoardEditDescription(board?.description ?? "");
                setBoardEditIsPublic(board?.is_public ?? true);
              }}
            >
              Cancel
            </button>
          </form>
        ) : null}

        <form onSubmit={createBoard} className="flex gap-2 flex-wrap">
          <input
            className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
            placeholder="Board title"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
          />
          <input
            className="border rounded-xl px-3 py-2 flex-1 min-w-[220px]"
            placeholder="Description (optional)"
            value={boardDescription}
            onChange={(e) => setBoardDescription(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={boardIsPublic}
              onChange={(e) => setBoardIsPublic(e.target.checked)}
            />
            Public
          </label>
          <button className="rounded-xl bg-black text-white px-4 py-2">
            Create board
          </button>
        </form>

        {showTrash ? (
          <div className="rounded-2xl border bg-gray-50 p-3">
            <h3 className="font-semibold">Trash</h3>
            {deletedBoards.length === 0 ? (
              <p className="text-sm text-gray-600">No deleted boards.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {deletedBoards.map((board) => (
                  <li
                    key={board.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">{board.title}</div>
                      {board.deleted_at ? (
                        <div className="text-xs text-gray-500">
                          Deleted{" "}
                          {new Date(board.deleted_at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => restoreBoard(board)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        </section>
      )}

      {isOnboarding && needsProfile ? null : (
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
            placeholder="Title (optional)"
            value={cardTitle}
            onChange={(e) => {
              setCardTitle(e.target.value);
              setCardTitleTouched(true);
            }}
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
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Cards</h3>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setShowDeletedCards((prev) => !prev)}
            >
              {showDeletedCards ? "Hide deleted" : "Show deleted"}
            </button>
          </div>
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
                    <input
                      className="w-full rounded-lg border px-2 py-1 text-sm font-semibold"
                      placeholder="Untitled"
                      value={c.title ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCards((prev) =>
                          prev.map((card) =>
                            card.id === c.id ? { ...card, title: next } : card
                          )
                        );
                      }}
                      onBlur={(e) => updateCardTitle(c.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <textarea
                      className="mt-2 w-full rounded-lg border px-2 py-1 text-sm text-gray-700"
                      placeholder="Description (optional)"
                      value={c.creator_note ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCards((prev) =>
                          prev.map((card) =>
                            card.id === c.id
                              ? { ...card, creator_note: next }
                              : card
                          )
                        );
                      }}
                      onBlur={(e) => updateCardNote(c.id, e.target.value)}
                    />
                    <div className="mt-2">
                      <button
                        type="button"
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

          {showDeletedCards ? (
            <div className="mt-3 space-y-2">
              <h4 className="text-sm font-semibold">Deleted cards</h4>
              {deletedCards.length === 0 ? (
                <p className="text-sm text-gray-600">No deleted cards.</p>
              ) : (
                <ul className="space-y-2">
                  {deletedCards.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {c.title ?? "Untitled"}
                        </div>
                        {c.deleted_at ? (
                          <div className="text-xs text-gray-500">
                            Deleted{" "}
                            {new Date(c.deleted_at).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1 text-sm"
                        onClick={() => restoreCard(c.id)}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        </section>
      )}
    </main>
  );
}
