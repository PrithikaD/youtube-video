import BoardClient from "../../../components/BoardClient";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const supabase = await createSupabaseServerClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title, slug, description, is_public, creator_id, deleted_at")
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
      "id, url, title, thumbnail_url, creator_note, created_at, source_type, youtube_video_id, youtube_timestamp"
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
      boardTitle={board.title}
      boardDescription={board.description ?? null}
      cards={cards ?? []}
      profileName={profile?.full_name ?? null}
      profileAvatarUrl={profile?.avatar_url ?? null}
    />
  );
}
