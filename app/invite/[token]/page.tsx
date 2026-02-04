import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("redeem_board_invite", {
    p_token: token,
  });

  const inviteRecord = Array.isArray(data) ? data[0] : data;
  let boardSlug =
    typeof inviteRecord === "string"
      ? inviteRecord
      : inviteRecord?.board_slug ?? inviteRecord?.slug ?? null;

  const boardId =
    inviteRecord?.board_id ??
    inviteRecord?.out_board_id ??
    inviteRecord?.boardId ??
    null;

  if (!boardSlug && boardId) {
    const { data: boardFromId } = await supabase
      .from("boards")
      .select("slug")
      .eq("id", boardId)
      .maybeSingle();
    boardSlug = boardFromId?.slug ?? null;
  }

  if (error || !boardSlug) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Invite invalid</h1>
        <p className="mt-2 text-gray-600">
          This invite link is invalid or expired.
        </p>
        {error ? (
          <pre className="mt-4 rounded-lg bg-gray-100 p-4 text-sm overflow-auto">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : null}
      </main>
    );
  }

  redirect(`/board/${encodeURIComponent(boardSlug)}`);
}
