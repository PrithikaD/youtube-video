import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabaseServer";

type SearchParams = {
  view?: string;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { view } = await searchParams;
  const isAllBoards = view === "all";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  let boardsQuery = supabase
    .from("boards")
    .select("id,title,slug,description,is_public")
    .order("created_at", { ascending: false });

  if (!isAllBoards) {
    boardsQuery = boardsQuery.eq("creator_id", user.id);
  } else {
    boardsQuery = boardsQuery.eq("is_public", true);
  }

  const { data: boards } = await boardsQuery;

  return (
    <main className="p-8">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile?.full_name ?? "Profile"}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {profile?.full_name ?? "Your profile"}
          </h1>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/profile"
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            !isAllBoards ? "bg-black text-white" : ""
          }`}
        >
          My Boards
        </Link>
        <Link
          href="/profile?view=all"
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            isAllBoards ? "bg-black text-white" : ""
          }`}
        >
          All Boards (public)
        </Link>
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-xl font-semibold">
          {isAllBoards ? "All public boards" : "Your boards"}
        </h2>
        {boards && boards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <Link
                key={board.id}
                href={`/board/${encodeURIComponent(board.slug)}`}
                className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="text-sm text-gray-500">
                  {board.is_public ? "Public" : "Private"}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{board.title}</h3>
                {board.description ? (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                    {board.description}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            {isAllBoards
              ? "No public boards yet."
              : "You haven’t created any boards yet."}
          </p>
        )}
      </section>
    </main>
  );
}
