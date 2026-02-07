export const ATELIER_VIEW_MODES = ["minimal", "dense"] as const;

export type AtelierViewMode = (typeof ATELIER_VIEW_MODES)[number];

export type AtelierGroup = {
  id: string;
  cardIds: string[];
  label?: string | null;
  color?: string | null;
  meta?: Record<string, unknown> | null;
};

export type AtelierConnector = {
  id: string;
  fromCardId: string;
  toCardId: string;
  label?: string | null;
  style?: string | null;
  meta?: Record<string, unknown> | null;
};

export type AtelierCardLayout = {
  cardId: string;
  x: number;
  y: number;
  zIndex: number;
};

export type AtelierLayoutPayload = {
  boardId: string;
  viewMode: AtelierViewMode;
  groups: AtelierGroup[];
  connectors: AtelierConnector[];
  cards: AtelierCardLayout[];
};

export type AtelierCardLayoutPatch = {
  cardId: string;
  x?: number;
  y?: number;
  zIndex?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalMetadata(
  value: unknown
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  return value;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

export function toFiniteInteger(value: unknown, fallback = 0): number {
  return Math.trunc(toFiniteNumber(value, fallback));
}

export function normalizeAtelierViewMode(
  value: unknown,
  fallback: AtelierViewMode = "minimal"
): AtelierViewMode {
  if (value === "minimal" || value === "dense") return value;
  return fallback;
}

export function sanitizeAtelierGroups(value: unknown): AtelierGroup[] {
  if (!Array.isArray(value)) return [];

  const groups: AtelierGroup[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = toOptionalString(entry.id);
    if (!id) continue;

    const rawCardIds = Array.isArray(entry.cardIds) ? entry.cardIds : [];
    const cardIds = rawCardIds
      .map((cardId) => (typeof cardId === "string" ? cardId.trim() : ""))
      .filter(Boolean);

    groups.push({
      id,
      cardIds,
      label: toOptionalString(entry.label) ?? null,
      color: toOptionalString(entry.color) ?? null,
      meta: toOptionalMetadata(entry.meta) ?? null,
    });
  }

  return groups;
}

export function sanitizeAtelierConnectors(value: unknown): AtelierConnector[] {
  if (!Array.isArray(value)) return [];

  const connectors: AtelierConnector[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = toOptionalString(entry.id);
    const fromCardId = toOptionalString(entry.fromCardId);
    const toCardId = toOptionalString(entry.toCardId);
    if (!id || !fromCardId || !toCardId) continue;

    connectors.push({
      id,
      fromCardId,
      toCardId,
      label: toOptionalString(entry.label) ?? null,
      style: toOptionalString(entry.style) ?? null,
      meta: toOptionalMetadata(entry.meta) ?? null,
    });
  }

  return connectors;
}

export function sanitizeAtelierCardLayoutPatches(
  value: unknown
): AtelierCardLayoutPatch[] {
  if (!Array.isArray(value)) return [];

  const patches: AtelierCardLayoutPatch[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const cardId = toOptionalString(entry.cardId);
    if (!cardId) continue;

    const hasX = typeof entry.x === "number" && Number.isFinite(entry.x);
    const hasY = typeof entry.y === "number" && Number.isFinite(entry.y);
    const hasZ =
      typeof entry.zIndex === "number" && Number.isFinite(entry.zIndex);

    if (!hasX && !hasY && !hasZ) continue;

    patches.push({
      cardId,
      x: hasX ? (entry.x as number) : undefined,
      y: hasY ? (entry.y as number) : undefined,
      zIndex: hasZ ? Math.trunc(entry.zIndex as number) : undefined,
    });
  }

  return patches;
}
