import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  normalizeAtelierViewMode,
  sanitizeAtelierCardLayoutPatches,
  sanitizeAtelierConnectors,
  sanitizeAtelierGroups,
  toFiniteInteger,
  toFiniteNumber,
  type AtelierCardLayoutPatch,
  type AtelierLayoutPayload,
  type AtelierViewMode,
} from "@/lib/atelierLayout";

type BoardRow = {
  id: string;
  creator_id: string;
  is_public: boolean;
  deleted_at: string | null;
  atelier_view_mode: string | null;
  atelier_groups: unknown;
  atelier_connectors: unknown;
};

type CardLayoutRow = {
  id: string;
  atelier_x: number | null;
  atelier_y: number | null;
  atelier_z: number | null;
};

async function getBoardRow(
  boardId: string
): Promise<{ board: BoardRow | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select(
      "id,creator_id,is_public,deleted_at,atelier_view_mode,atelier_groups,atelier_connectors"
    )
    .eq("id", boardId)
    .maybeSingle();

  if (error) return { board: null, error: error.message };
  return { board: (data as BoardRow | null) ?? null, error: null };
}

async function canReadBoard(board: BoardRow, userId: string | null) {
  if (board.is_public) return true;
  if (!userId) return false;
  if (board.creator_id === userId) return true;

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("board_members")
    .select("board_id")
    .eq("board_id", board.id)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(membership);
}

async function getLayoutPayload(board: BoardRow): Promise<{
  layout: AtelierLayoutPayload | null;
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id,atelier_x,atelier_y,atelier_z")
    .eq("board_id", board.id)
    .is("deleted_at", null);

  if (error) return { layout: null, error: error.message };

  const layout: AtelierLayoutPayload = {
    boardId: board.id,
    viewMode: normalizeAtelierViewMode(board.atelier_view_mode),
    groups: sanitizeAtelierGroups(board.atelier_groups),
    connectors: sanitizeAtelierConnectors(board.atelier_connectors),
    cards: ((cards as CardLayoutRow[] | null) ?? []).map((card) => ({
      cardId: card.id,
      x: toFiniteNumber(card.atelier_x, 0),
      y: toFiniteNumber(card.atelier_y, 0),
      zIndex: toFiniteInteger(card.atelier_z, 0),
    })),
  };

  return { layout, error: null };
}

function parseViewMode(value: unknown): AtelierViewMode | null {
  if (value === "minimal" || value === "dense") return value;
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId: rawBoardId } = await context.params;
  const boardId = decodeURIComponent(rawBoardId);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { board, error: boardError } = await getBoardRow(boardId);
  if (boardError) {
    return NextResponse.json({ error: boardError }, { status: 500 });
  }
  if (!board || board.deleted_at) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const canRead = await canReadBoard(board, user?.id ?? null);
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { layout, error: layoutError } = await getLayoutPayload(board);
  if (layoutError || !layout) {
    return NextResponse.json(
      { error: layoutError ?? "Failed to load layout" },
      { status: 500 }
    );
  }

  return NextResponse.json({ layout }, { status: 200 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId: rawBoardId } = await context.params;
  const boardId = decodeURIComponent(rawBoardId);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { board, error: boardError } = await getBoardRow(boardId);
  if (boardError) {
    return NextResponse.json({ error: boardError }, { status: 500 });
  }
  if (!board || board.deleted_at) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  if (board.creator_id !== user.id) {
    return NextResponse.json(
      { error: "Only the board creator can update layout." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        viewMode?: unknown;
        groups?: unknown;
        connectors?: unknown;
        cards?: unknown;
      }
    | null;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasViewMode = Object.prototype.hasOwnProperty.call(body, "viewMode");
  const hasGroups = Object.prototype.hasOwnProperty.call(body, "groups");
  const hasConnectors = Object.prototype.hasOwnProperty.call(body, "connectors");
  const hasCards = Object.prototype.hasOwnProperty.call(body, "cards");

  const boardUpdate: {
    atelier_view_mode?: AtelierViewMode;
    atelier_groups?: ReturnType<typeof sanitizeAtelierGroups>;
    atelier_connectors?: ReturnType<typeof sanitizeAtelierConnectors>;
  } = {};

  if (hasViewMode) {
    const parsed = parseViewMode(body.viewMode);
    if (!parsed) {
      return NextResponse.json(
        { error: "viewMode must be 'minimal' or 'dense'" },
        { status: 400 }
      );
    }
    boardUpdate.atelier_view_mode = parsed;
  }

  if (hasGroups) {
    if (!Array.isArray(body.groups)) {
      return NextResponse.json(
        { error: "groups must be an array" },
        { status: 400 }
      );
    }
    boardUpdate.atelier_groups = sanitizeAtelierGroups(body.groups);
  }

  if (hasConnectors) {
    if (!Array.isArray(body.connectors)) {
      return NextResponse.json(
        { error: "connectors must be an array" },
        { status: 400 }
      );
    }
    boardUpdate.atelier_connectors = sanitizeAtelierConnectors(body.connectors);
  }

  let cardPatches: AtelierCardLayoutPatch[] = [];
  if (hasCards) {
    if (!Array.isArray(body.cards)) {
      return NextResponse.json(
        { error: "cards must be an array" },
        { status: 400 }
      );
    }
    cardPatches = sanitizeAtelierCardLayoutPatches(body.cards);
  }

  const dedupedPatches = new Map<string, AtelierCardLayoutPatch>();
  cardPatches.forEach((patch) => {
    dedupedPatches.set(patch.cardId, patch);
  });
  cardPatches = Array.from(dedupedPatches.values());

  if (
    Object.keys(boardUpdate).length === 0 &&
    (!hasCards || cardPatches.length === 0)
  ) {
    return NextResponse.json(
      { error: "No valid layout fields to update" },
      { status: 400 }
    );
  }

  if (Object.keys(boardUpdate).length > 0) {
    const { error: updateBoardError } = await supabase
      .from("boards")
      .update(boardUpdate)
      .eq("id", board.id);

    if (updateBoardError) {
      return NextResponse.json(
        { error: updateBoardError.message },
        { status: 500 }
      );
    }
  }

  if (cardPatches.length > 0) {
    const cardIds = cardPatches.map((patch) => patch.cardId);
    const { data: existingCards, error: existingCardsError } = await supabase
      .from("cards")
      .select("id")
      .eq("board_id", board.id)
      .is("deleted_at", null)
      .in("id", cardIds);

    if (existingCardsError) {
      return NextResponse.json(
        { error: existingCardsError.message },
        { status: 500 }
      );
    }

    const existingCardIdSet = new Set(
      (existingCards ?? []).map((card) => card.id as string)
    );
    const missing = cardIds.filter((id) => !existingCardIdSet.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Some cards are missing or not part of this board", missing },
        { status: 400 }
      );
    }

    const updateResults = await Promise.all(
      cardPatches.map(async (patch) => {
        const updateData: {
          atelier_x?: number;
          atelier_y?: number;
          atelier_z?: number;
        } = {};

        if (typeof patch.x === "number" && Number.isFinite(patch.x)) {
          updateData.atelier_x = patch.x;
        }
        if (typeof patch.y === "number" && Number.isFinite(patch.y)) {
          updateData.atelier_y = patch.y;
        }
        if (typeof patch.zIndex === "number" && Number.isFinite(patch.zIndex)) {
          updateData.atelier_z = Math.trunc(patch.zIndex);
        }

        if (Object.keys(updateData).length === 0) return null;

        const { error: updateError } = await supabase
          .from("cards")
          .update(updateData)
          .eq("id", patch.cardId)
          .eq("board_id", board.id)
          .is("deleted_at", null);

        return updateError?.message ?? null;
      })
    );

    const firstError = updateResults.find((msg) => typeof msg === "string");
    if (typeof firstError === "string") {
      return NextResponse.json({ error: firstError }, { status: 500 });
    }
  }

  const { board: updatedBoard, error: updatedBoardError } = await getBoardRow(
    board.id
  );
  if (updatedBoardError || !updatedBoard) {
    return NextResponse.json(
      { error: updatedBoardError ?? "Failed to load updated board layout" },
      { status: 500 }
    );
  }

  const { layout, error: layoutError } = await getLayoutPayload(updatedBoard);
  if (layoutError || !layout) {
    return NextResponse.json(
      { error: layoutError ?? "Failed to load updated layout" },
      { status: 500 }
    );
  }

  return NextResponse.json({ layout }, { status: 200 });
}
