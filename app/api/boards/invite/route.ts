import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Must be authenticated." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const boardId = body?.boardId as string | undefined;

  if (!boardId) {
    return NextResponse.json(
      { error: "Board id is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("create_board_invite", {
    p_board_id: boardId,
    p_expires_at: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ token: data });
}
