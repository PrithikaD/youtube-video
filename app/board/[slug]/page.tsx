import BoardClient from "../../../components/BoardClient";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";
import { getSupabaseConfigError } from "../../../lib/supabaseConfig";
import SupabaseEnvNotice from "../../../components/SupabaseEnvNotice";
import {
  normalizeAtelierViewMode,
  sanitizeAtelierConnectors,
  sanitizeAtelierGroups,
  toFiniteInteger,
  toFiniteNumber,
} from "../../../lib/atelierLayout";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const configError = getSupabaseConfigError();
  if (configError) {
    return <SupabaseEnvNotice />;
  }

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const supabase = await createSupabaseServerClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      "id, title, slug, description, is_public, creator_id, deleted_at, atelier_view_mode, atelier_groups, atelier_connectors"
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (boardError || !board) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Board not found</h1>
        <p className="mt-2 text-gray-600">Slug: {slug}</p>
      </main>
    );
  }

  if (!board.is_public) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isMember = false;
    if (user && user.id !== board.creator_id) {
      const { data: membership } = await supabase
        .from("board_members")
        .select("board_id")
        .eq("board_id", board.id)
        .eq("user_id", user.id)
        .maybeSingle();
      isMember = Boolean(membership);
    }

    if (!user || (user.id !== board.creator_id && !isMember)) {
      return (
        <main className="p-8">
          <h1 className="text-2xl font-semibold">Private board</h1>
          <p className="mt-2 text-gray-600">
            You need access from the board owner to view this board.
          </p>
        </main>
      );
    }
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, url, title, thumbnail_url, creator_note, created_at, source_type, youtube_video_id, youtube_timestamp, atelier_x, atelier_y, atelier_z"
    )
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (cardsError) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Error loading cards</h1>
        <pre className="mt-4 rounded-lg bg-gray-100 p-4 text-sm overflow-auto">
          {JSON.stringify(cardsError, null, 2)}
        </pre>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", board.creator_id)
    .maybeSingle();

  return (
    <BoardClient
      boardId={board.id}
      boardTitle={board.title}
      boardDescription={board.description ?? null}
      cards={cards ?? []}
      initialAtelierLayout={{
        boardId: board.id,
        viewMode: normalizeAtelierViewMode(board.atelier_view_mode),
        groups: sanitizeAtelierGroups(board.atelier_groups),
        connectors: sanitizeAtelierConnectors(board.atelier_connectors),
        cards: (cards ?? []).map((card) => ({
          cardId: card.id,
          x: toFiniteNumber(card.atelier_x, 0),
          y: toFiniteNumber(card.atelier_y, 0),
          zIndex: toFiniteInteger(card.atelier_z, 0),
        })),
      }}
      atelierLayoutApiPath={`/api/boards/${encodeURIComponent(
        board.id
      )}/atelier-layout`}
      profileName={profile?.full_name ?? null}
      profileAvatarUrl={profile?.avatar_url ?? null}
    />
  );
}
