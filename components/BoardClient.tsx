"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import CardModal from "./CardModal";
import YouTubeEmbed from "./YouTubeEmbed";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "../lib/youtube";
import type { AtelierLayoutPayload } from "../lib/atelierLayout";

type Card = {
  id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  creator_note: string | null;
  source_type?: "web" | "youtube" | string | null;
  youtube_video_id?: string | null;
  youtube_timestamp?: number | null;
  atelier_x?: number | null;
  atelier_y?: number | null;
  atelier_z?: number | null;
};

type ViewMode = "minimal" | "dense";

type Camera = {
  x: number;
  y: number;
  scale: number;
};

type CardPosition = {
  x: number;
  y: number;
};

type Connector = {
  id: string;
  from: string;
  to: string;
  label?: string | null;
  style?: string | null;
  meta?: Record<string, unknown> | null;
};

type BoardClientProps = {
  boardId: string;
  boardTitle: string;
  boardDescription?: string | null;
  cards: Card[];
  initialAtelierLayout?: AtelierLayoutPayload | null;
  atelierLayoutApiPath?: string | null;
  profileName?: string | null;
  profileAvatarUrl?: string | null;
};

const CLUSTER_COLORS = [
  "#f5d8c7",
  "#d9e8df",
  "#f8e5b8",
  "#d9e7f7",
  "#e8dcf5",
];

const INITIAL_CAMERA: Camera = {
  x: 260,
  y: 140,
  scale: 1,
};

const MOBILE_BREAKPOINT = 900;

function formatSeconds(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }

  return `${m}:${s.toString().padStart(2, "0")}`;
}

function createInitialPosition(index: number): CardPosition {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const jitterX = ((index * 37) % 80) - 40;
  const jitterY = ((index * 53) % 70) - 35;

  return {
    x: column * 380 + jitterX,
    y: row * 350 + jitterY,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getInitialCardPositions(cards: Card[], layout?: AtelierLayoutPayload | null) {
  const next: Record<string, CardPosition> = {};

  cards.forEach((card, index) => {
    const fromLayout = layout?.cards.find((entry) => entry.cardId === card.id);

    if (fromLayout && isFiniteNumber(fromLayout.x) && isFiniteNumber(fromLayout.y)) {
      next[card.id] = { x: fromLayout.x, y: fromLayout.y };
      return;
    }

    if (isFiniteNumber(card.atelier_x) && isFiniteNumber(card.atelier_y)) {
      next[card.id] = { x: card.atelier_x, y: card.atelier_y };
      return;
    }

    next[card.id] = createInitialPosition(index);
  });

  return next;
}

function getInitialCardZIndices(cards: Card[], layout?: AtelierLayoutPayload | null) {
  const next: Record<string, number> = {};

  cards.forEach((card) => {
    const fromLayout = layout?.cards.find((entry) => entry.cardId === card.id);
    if (fromLayout && isFiniteNumber(fromLayout.zIndex)) {
      next[card.id] = Math.trunc(fromLayout.zIndex);
      return;
    }

    if (isFiniteNumber(card.atelier_z)) {
      next[card.id] = Math.trunc(card.atelier_z);
      return;
    }

    next[card.id] = 0;
  });

  return next;
}

function mergeCardPositions(
  cards: Card[],
  current: Record<string, CardPosition>,
  persisted: Record<string, CardPosition>
) {
  const next: Record<string, CardPosition> = {};

  cards.forEach((card, index) => {
    next[card.id] = current[card.id] ?? persisted[card.id] ?? createInitialPosition(index);
  });

  return next;
}

function mergeCardZIndices(
  cards: Card[],
  current: Record<string, number>,
  persisted: Record<string, number>
) {
  const next: Record<string, number> = {};

  cards.forEach((card) => {
    next[card.id] = current[card.id] ?? persisted[card.id] ?? 0;
  });

  return next;
}

function getNextZIndex(zIndices: Record<string, number>) {
  const values = Object.values(zIndices);
  if (values.length === 0) return 1;
  return Math.max(...values) + 1;
}

function normalizeViewMode(mode: string | null | undefined): ViewMode {
  return mode === "dense" ? "dense" : "minimal";
}

export default function BoardClient({
  boardId,
  boardTitle,
  boardDescription,
  cards,
  initialAtelierLayout,
  atelierLayoutApiPath,
  profileName,
  profileAvatarUrl,
}: BoardClientProps) {
  const persistedPositions = useMemo(
    () => getInitialCardPositions(cards, initialAtelierLayout),
    [cards, initialAtelierLayout]
  );
  const persistedZIndices = useMemo(
    () => getInitialCardZIndices(cards, initialAtelierLayout),
    [cards, initialAtelierLayout]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    normalizeViewMode(initialAtelierLayout?.viewMode)
  );
  const [isMobile, setIsMobile] = useState(false);
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const [cardPositions, setCardPositions] = useState<Record<string, CardPosition>>(
    () => mergeCardPositions(cards, {}, persistedPositions)
  );
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    mergeCardZIndices(cards, {}, persistedZIndices)
  );
  const [nextZIndex, setNextZIndex] = useState<number>(() =>
    getNextZIndex(mergeCardZIndices(cards, {}, persistedZIndices))
  );
  const [connectors, setConnectors] = useState<Connector[]>(
    () =>
      initialAtelierLayout?.connectors.map((connector) => ({
        id: connector.id,
        from: connector.fromCardId,
        to: connector.toCardId,
        label: connector.label ?? null,
        style: connector.style ?? null,
        meta: connector.meta ?? null,
      })) ?? []
  );
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectorStart, setConnectorStart] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const panningRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const draggingRef = useRef<{
    pointerId: number;
    cardId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const connectorCounterRef = useRef(0);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = false;
  }, [boardId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const apply = () => setIsMobile(media.matches);

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setCardPositions((prev) => mergeCardPositions(cards, prev, persistedPositions));
  }, [cards, persistedPositions]);

  useEffect(() => {
    setCardZIndices((prev) => {
      const merged = mergeCardZIndices(cards, prev, persistedZIndices);
      setNextZIndex(getNextZIndex(merged));
      return merged;
    });
  }, [cards, persistedZIndices]);

  useEffect(() => {
    if (!initialAtelierLayout) return;
    setViewMode(normalizeViewMode(initialAtelierLayout.viewMode));
    setConnectors(
      initialAtelierLayout.connectors.map((connector) => ({
        id: connector.id,
        from: connector.fromCardId,
        to: connector.toCardId,
        label: connector.label ?? null,
        style: connector.style ?? null,
        meta: connector.meta ?? null,
      }))
    );
  }, [initialAtelierLayout]);

  useEffect(() => {
    if (!atelierLayoutApiPath) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const payload = {
        viewMode,
        groups: initialAtelierLayout?.groups ?? [],
        connectors: connectors.map((connector) => ({
          id: connector.id,
          fromCardId: connector.from,
          toCardId: connector.to,
          label: connector.label ?? null,
          style: connector.style ?? "curved-dash",
          meta: connector.meta ?? null,
        })),
        cards: cards.map((card, index) => {
          const position = cardPositions[card.id] ?? createInitialPosition(index);
          return {
            cardId: card.id,
            x: position.x,
            y: position.y,
            zIndex: cardZIndices[card.id] ?? 0,
          };
        }),
      };

      void fetch(atelierLayoutApiPath, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    atelierLayoutApiPath,
    cards,
    cardZIndices,
    cardPositions,
    connectors,
    initialAtelierLayout,
    viewMode,
  ]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId]
  );

  const cardWidth = viewMode === "minimal" ? 340 : 260;
  const cardHeight = viewMode === "minimal" ? 304 : 244;

  const connectorPaths = useMemo(() => {
    return connectors
      .map((connector) => {
        const from = cardPositions[connector.from];
        const to = cardPositions[connector.to];
        if (!from || !to) return null;

        const startX = from.x + cardWidth / 2;
        const startY = from.y + cardHeight / 2;
        const endX = to.x + cardWidth / 2;
        const endY = to.y + cardHeight / 2;
        const controlX = (startX + endX) / 2;

        return {
          id: connector.id,
          d: `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`,
        };
      })
      .filter((value): value is { id: string; d: string } => Boolean(value));
  }, [cardHeight, cardPositions, cardWidth, connectors]);

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-card-shell='true']")) return;

    panningRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: camera.x,
      originY: camera.y,
    };
    setIsPanning(true);

    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const panning = panningRef.current;
    if (!panning || panning.pointerId !== e.pointerId) return;

    const nextX = panning.originX + (e.clientX - panning.startX);
    const nextY = panning.originY + (e.clientY - panning.startY);

    setCamera((prev) => ({ ...prev, x: nextX, y: nextY }));
  }

  function handleCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const panning = panningRef.current;
    if (!panning || panning.pointerId !== e.pointerId) return;

    panningRef.current = null;
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleCanvasWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();

    const direction = e.deltaY > 0 ? -1 : 1;
    const delta = direction * 0.1;

    setCamera((prev) => {
      const nextScale = Math.min(1.8, Math.max(0.55, prev.scale + delta));
      return {
        ...prev,
        scale: nextScale,
      };
    });
  }

  function startCardDrag(
    e: React.PointerEvent<HTMLElement>,
    cardId: string,
    x: number,
    y: number
  ) {
    if (isConnectMode) {
      if (!connectorStart) {
        setConnectorStart(cardId);
        setStatusNote("Select a second card to create a connector.");
        return;
      }

      if (connectorStart === cardId) {
        setConnectorStart(null);
        setStatusNote("Connector start cleared.");
        return;
      }

      connectorCounterRef.current += 1;
      const id = `${connectorStart}-${cardId}-${connectorCounterRef.current}`;
      setConnectors((prev) => [
        ...prev,
        {
          id,
          from: connectorStart,
          to: cardId,
          label: null,
          style: "curved-dash",
          meta: null,
        },
      ]);
      setConnectorStart(null);
      setStatusNote("Connector added.");
      return;
    }

    const raisedZIndex = nextZIndex;
    setNextZIndex((prev) => prev + 1);
    setCardZIndices((prev) => ({
      ...prev,
      [cardId]: raisedZIndex,
    }));

    draggingRef.current = {
      pointerId: e.pointerId,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      originX: x,
      originY: y,
      moved: false,
    };
    setDraggingCardId(cardId);

    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveCardDrag(e: React.PointerEvent<HTMLElement>) {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = (e.clientX - drag.startX) / camera.scale;
    const dy = (e.clientY - drag.startY) / camera.scale;

    if (!drag.moved && Math.hypot(dx, dy) > 2) {
      drag.moved = true;
    }

    setCardPositions((prev) => ({
      ...prev,
      [drag.cardId]: {
        x: drag.originX + dx,
        y: drag.originY + dy,
      },
    }));
  }

  function endCardDrag(e: React.PointerEvent<HTMLElement>) {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    e.currentTarget.releasePointerCapture(e.pointerId);

    if (!drag.moved) {
      setSelectedId(drag.cardId);
    }

    draggingRef.current = null;
    setDraggingCardId(null);
  }

  function resetCanvas() {
    setCamera(INITIAL_CAMERA);
    setCardPositions(mergeCardPositions(cards, {}, persistedPositions));
    const resetZ = mergeCardZIndices(cards, {}, persistedZIndices);
    setCardZIndices(resetZ);
    setNextZIndex(getNextZIndex(resetZ));
    setStatusNote("Canvas reset.");
  }

  function clearConnectors() {
    setConnectors([]);
    setConnectorStart(null);
    setStatusNote("Connectors cleared.");
  }

  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    setStatusNote(mode === "minimal" ? "Minimal board view" : "Dense board view");
  }

  function toggleConnectMode() {
    setIsConnectMode((prev) => {
      const next = !prev;
      setConnectorStart(null);
      setStatusNote(next ? "Connector mode on." : "Connector mode off.");
      return next;
    });
  }

  const header = (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-4 pt-5 md:px-7 md:pt-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-full border border-[#d8cdbf] bg-[#f6eee4] shadow-sm">
          {profileAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileAvatarUrl}
              alt={profileName ?? "Profile"}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#7f6f5f]">
            Curated by {profileName ?? "Unknown"}
          </p>
          <h1
            className="text-3xl text-[#3f2f22] md:text-4xl"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            {boardTitle}
          </h1>
          {boardDescription ? (
            <p className="max-w-2xl pt-1 text-sm text-[#5f5347] md:text-base">
              {boardDescription}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/profile"
          className="rounded-full border border-[#d3c5b6] bg-[#f7efe4] px-3 py-1.5 text-[#4f4135] transition hover:bg-[#f3e7d6]"
        >
          Profile
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-[#d3c5b6] bg-[#f7efe4] px-3 py-1.5 text-[#4f4135] transition hover:bg-[#f3e7d6]"
        >
          Dashboard
        </Link>
      </div>
    </header>
  );

  if (cards.length === 0) {
    return (
      <main className="atelier-bg min-h-screen pb-28">
        {header}
        <section className="mx-auto mt-12 max-w-xl rounded-[24px] border border-[#d5c8ba] bg-[#fffdf9] p-8 text-center shadow-[0_18px_40px_rgba(109,85,56,0.14)]">
          <h2
            className="text-2xl text-[#3f2f22]"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            The Infinite Atelier
          </h2>
          <p className="mt-3 text-[#66584a]">
            This board is empty. Capture links from YouTube or the web to begin your visual collage.
          </p>
        </section>
      </main>
    );
  }

  if (isMobile) {
    return (
      <main className="atelier-bg min-h-screen pb-24">
        {header}
        <section className="mt-6 px-4 pb-6">
          <p className="pb-3 text-xs uppercase tracking-[0.2em] text-[#7f6f5f]">
            Swipe your deck
          </p>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {cards.map((card, index) => {
              const videoId = card.youtube_video_id ?? getYouTubeVideoId(card.url);
              const thumbnailUrl =
                card.thumbnail_url ??
                (videoId ? getYouTubeThumbnailUrl(videoId) : null);
              const isYouTube = Boolean(videoId);
              const chipColor = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
              const timestamp = card.youtube_timestamp ?? 0;
              const timelineProgress = Math.min(1, timestamp / 600);

              return (
                <article
                  key={card.id}
                  className={`snap-center shrink-0 rounded-[20px] border border-[#ddcebf] bg-[#fffdfb] p-4 shadow-[0_20px_34px_rgba(88,68,45,0.14)] ${
                    viewMode === "minimal" ? "w-[82vw]" : "w-[65vw]"
                  }`}
                  onClick={() => setSelectedId(card.id)}
                >
                  <div className="mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium text-[#564537]" style={{ background: chipColor }}>
                    Cluster {index + 1}
                  </div>

                  {isYouTube ? (
                    <YouTubeEmbed
                      url={card.url}
                      title={card.title}
                      videoId={videoId}
                      startSeconds={card.youtube_timestamp ?? 0}
                      thumbnailUrl={thumbnailUrl}
                      className={viewMode === "minimal" ? "h-44 w-full rounded-2xl" : "h-32 w-full rounded-xl"}
                    />
                  ) : thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt={card.title ?? "Card"}
                      className={`${viewMode === "minimal" ? "h-44" : "h-32"} w-full rounded-2xl object-cover`}
                    />
                  ) : (
                    <div className={`${viewMode === "minimal" ? "h-44" : "h-32"} w-full rounded-2xl bg-[#ece2d7]`} />
                  )}

                  <h2 className="mt-3 line-clamp-2 text-base font-semibold text-[#33271f]">
                    {card.title ?? "Untitled"}
                  </h2>
                  {viewMode === "dense" || card.creator_note ? (
                    <p className="mt-2 line-clamp-3 text-sm text-[#5f5347]">
                      {card.creator_note ?? "Tap to open notes and source."}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-full bg-[#efe4d7] p-1">
                    <div
                      className="h-1.5 rounded-full bg-[#b88753]"
                      style={{ width: `${Math.max(10, timelineProgress * 100)}%` }}
                    />
                  </div>
                  {timestamp > 0 ? (
                    <p className="mt-1 text-xs text-[#7a6a5c]">
                      Starts at {formatSeconds(timestamp)}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center justify-between rounded-full border border-[#d9cab9] bg-[#fff8ef]/95 px-3 py-2 shadow-[0_16px_28px_rgba(93,73,49,0.18)] backdrop-blur">
            <button
              type="button"
              onClick={() => toggleView("minimal")}
              className={`rounded-full px-3 py-1.5 text-xs ${
                viewMode === "minimal" ? "bg-[#3d2f25] text-[#f7efe4]" : "text-[#4f4135]"
              }`}
            >
              Minimal
            </button>
            <button
              type="button"
              onClick={() => toggleView("dense")}
              className={`rounded-full px-3 py-1.5 text-xs ${
                viewMode === "dense" ? "bg-[#3d2f25] text-[#f7efe4]" : "text-[#4f4135]"
              }`}
            >
              Dense
            </button>
          </div>
        </div>

        <CardModal card={selectedCard} onClose={() => setSelectedId(null)} />
      </main>
    );
  }

  return (
    <main className="atelier-bg relative min-h-screen overflow-hidden pb-28">
      {header}

      <div className="absolute left-5 top-32 z-20 rounded-2xl border border-[#d7c8b8] bg-[#fff7ed]/95 px-4 py-3 text-xs text-[#625445] shadow-[0_14px_32px_rgba(90,70,47,0.12)] backdrop-blur">
        <p className="uppercase tracking-[0.16em] text-[#7f6f5f]">Canvas Mode</p>
        <p className="pt-1">Drag cards to arrange. Drag empty canvas to pan. Scroll to zoom.</p>
        {statusNote ? <p className="pt-2 text-[#7b5233]">{statusNote}</p> : null}
      </div>

      <section
        className="absolute inset-0 pt-32"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onWheel={handleCanvasWheel}
      >
        <div
          className="atelier-canvas relative h-[3600px] w-[5200px] origin-top-left"
          style={{
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
            transition: isPanning ? "none" : "transform 120ms ease-out",
          }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {connectorPaths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                stroke="#9b7a58"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="8 8"
                opacity={0.72}
              />
            ))}
          </svg>

          {cards.map((card, index) => {
            const pos = cardPositions[card.id] ?? createInitialPosition(index);
            const videoId = card.youtube_video_id ?? getYouTubeVideoId(card.url);
            const isYouTube = Boolean(videoId);
            const thumbnailUrl =
              card.thumbnail_url ??
              (videoId ? getYouTubeThumbnailUrl(videoId) : null);
            const timestamp = card.youtube_timestamp ?? 0;
            const timelineProgress = Math.min(1, timestamp / 600);
            const chipColor = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
            const dragging = draggingCardId === card.id;

            return (
              <article
                key={card.id}
                data-card-shell="true"
                className={`absolute select-none rounded-[16px] border border-[#dccfbe] bg-[#fffefc] p-3 shadow-[0_20px_42px_rgba(96,76,53,0.18)] transition ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: cardWidth,
                  zIndex: cardZIndices[card.id] ?? 0,
                  transform: dragging ? "scale(1.01) rotate(-0.4deg)" : "scale(1)",
                }}
                onPointerDown={(e) => startCardDrag(e, card.id, pos.x, pos.y)}
                onPointerMove={moveCardDrag}
                onPointerUp={endCardDrag}
                onPointerCancel={endCardDrag}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-[#5d4a3b]"
                    style={{ background: chipColor }}
                  >
                    Cluster {index + 1}
                  </div>
                  {connectorStart === card.id ? (
                    <div className="rounded-full bg-[#3d2f25] px-2 py-0.5 text-[11px] text-[#f3e7da]">
                      Start
                    </div>
                  ) : null}
                </div>

                {isYouTube ? (
                  <YouTubeEmbed
                    url={card.url}
                    title={card.title}
                    videoId={videoId}
                    startSeconds={card.youtube_timestamp ?? 0}
                    thumbnailUrl={thumbnailUrl}
                    className={viewMode === "minimal" ? "h-40 w-full rounded-xl" : "h-28 w-full rounded-xl"}
                  />
                ) : thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt={card.title ?? "Card"}
                    className={`${viewMode === "minimal" ? "h-40" : "h-28"} w-full rounded-xl object-cover`}
                  />
                ) : (
                  <div className={`${viewMode === "minimal" ? "h-40" : "h-28"} w-full rounded-xl bg-[#eee1d2]`} />
                )}

                <h2 className="mt-3 line-clamp-2 text-[15px] font-semibold text-[#2f241d]">
                  {card.title ?? "Untitled"}
                </h2>
                {viewMode === "dense" || card.creator_note ? (
                  <p className="mt-1.5 line-clamp-3 text-sm text-[#5f5347]">
                    {card.creator_note ?? "Open for details and source."}
                  </p>
                ) : null}

                <div className="mt-3 rounded-full bg-[#f0e2d2] p-1">
                  <div
                    className="h-1.5 rounded-full bg-[#b88753]"
                    style={{ width: `${Math.max(10, timelineProgress * 100)}%` }}
                  />
                </div>
                {timestamp > 0 ? (
                  <p className="mt-1 text-xs text-[#7a6a5c]">
                    Starts at {formatSeconds(timestamp)}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <div className="flex items-center gap-2 rounded-full border border-[#d7c8b8] bg-[#fff8ef]/95 p-2 shadow-[0_16px_28px_rgba(93,73,49,0.18)] backdrop-blur">
          <button
            type="button"
            onClick={() => toggleView("minimal")}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              viewMode === "minimal"
                ? "bg-[#3d2f25] text-[#f7efe4]"
                : "text-[#4f4135] hover:bg-[#f2e4d4]"
            }`}
          >
            Minimal
          </button>
          <button
            type="button"
            onClick={() => toggleView("dense")}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              viewMode === "dense"
                ? "bg-[#3d2f25] text-[#f7efe4]"
                : "text-[#4f4135] hover:bg-[#f2e4d4]"
            }`}
          >
            Dense
          </button>
          <button
            type="button"
            onClick={toggleConnectMode}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              isConnectMode
                ? "bg-[#8f5c35] text-[#f8ecdf]"
                : "text-[#4f4135] hover:bg-[#f2e4d4]"
            }`}
          >
            {isConnectMode ? "Connecting" : "Connect"}
          </button>
          <button
            type="button"
            onClick={clearConnectors}
            className="rounded-full px-3 py-1.5 text-xs text-[#4f4135] transition hover:bg-[#f2e4d4]"
          >
            Clear lines
          </button>
          <button
            type="button"
            onClick={resetCanvas}
            className="rounded-full px-3 py-1.5 text-xs text-[#4f4135] transition hover:bg-[#f2e4d4]"
          >
            Reset
          </button>
        </div>
      </nav>

      <CardModal card={selectedCard} onClose={() => setSelectedId(null)} />
    </main>
  );
}
