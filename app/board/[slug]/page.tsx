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
    .select("id, title, slug, is_public, creator_id")
    .eq("slug", slug)
    .single();

  if (boardError || !board) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Board not found</h1>
        <p className="mt-2 text-gray-600">Slug: {slug}</p>
      </main>
    );
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, url, title, thumbnail_url, creator_note, created_at, source_type, youtube_video_id, youtube_timestamp"
    )
    .eq("board_id", board.id)
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
      boardSlug={board.slug}
      cards={cards ?? []}
      profileName={profile?.full_name ?? null}
      profileAvatarUrl={profile?.avatar_url ?? null}
    />
  );
}
