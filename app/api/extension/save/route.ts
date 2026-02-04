import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  getYouTubeStartSeconds,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
} from "@/lib/youtube";
import { slugify } from "@/lib/slug";

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  return null;
}

function withCors(request: Request, response: NextResponse) {
  const origin = getCorsOrigin(request);
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(request, response);
}

async function getOrCreateInboxBoardId(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("boards")
    .select("id,deleted_at")
    .eq("creator_id", userId)
    .eq("slug", "inbox")
    .maybeSingle();

  if (existing?.id) {
    if (existing.deleted_at) {
      const { error: restoreError } = await supabase
        .from("boards")
        .update({ deleted_at: null })
        .eq("id", existing.id);
      if (restoreError) return null;
    }
    return existing.id;
  }

  const title = "Inbox";
  const slug = slugify(title);
  const { data, error } = await supabase
    .from("boards")
    .insert({
      creator_id: userId,
      title,
      slug,
      description: "Auto-created for quick saves",
      is_public: false,
    })
    .select("id")
    .single();

  if (error) return null;
  return data?.id ?? null;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    return withCors(request, response);
  }

  let body: {
    url?: string;
    title?: string;
    thumbnail?: string;
    note?: string;
    boardId?: string;
    useInbox?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    const response = NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
    return withCors(request, response);
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    const response = NextResponse.json(
      { error: "Missing URL" },
      { status: 400 }
    );
    return withCors(request, response);
  }

  let boardId = body.boardId ?? "";
  if (body.useInbox || !boardId) {
    const inboxId = await getOrCreateInboxBoardId(authData.user.id);
    if (!inboxId) {
      const response = NextResponse.json(
        { error: "Unable to resolve Inbox" },
        { status: 500 }
      );
      return withCors(request, response);
    }
    boardId = inboxId;
  }

  const { data: boardRow, error: boardError } = await supabase
    .from("boards")
    .select("id,slug,deleted_at")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !boardRow || boardRow.deleted_at) {
    const response = NextResponse.json(
      { error: "Board is unavailable" },
      { status: 400 }
    );
    return withCors(request, response);
  }

  const videoId = getYouTubeVideoId(url);
  const timestamp = videoId ? getYouTubeStartSeconds(url) : null;
  const thumbnail =
    (body.thumbnail ?? "").trim() ||
    (videoId ? getYouTubeThumbnailUrl(videoId) : "");

  const { error } = await supabase.from("cards").insert({
    board_id: boardId,
    url,
    title: body.title?.trim() ? body.title.trim() : null,
    creator_note: body.note?.trim() ? body.note.trim() : null,
    thumbnail_url: thumbnail || null,
    source_type: videoId ? "youtube" : "web",
    youtube_video_id: videoId,
    youtube_timestamp: timestamp,
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return withCors(request, response);
  }

  const response = NextResponse.json(
    { ok: true, boardSlug: boardRow.slug ?? null },
    { status: 200 }
  );
  return withCors(request, response);
}
