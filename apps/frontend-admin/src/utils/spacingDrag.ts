import type { BoxQuad } from '../components/StyleBoxEdges';

import { isRotateNudgeKey } from './rotateDrag';

export type SpacingEdge = 'top' | 'right' | 'bottom' | 'left';
export const SPACING_EDGES: SpacingEdge[] = ['top', 'right', 'bottom', 'left'];
export type BoxDragKind = 'padding' | 'margin' | 'radius' | 'size' | 'position' | 'rotate';
export type SpacingCursor = 'ns-resize' | 'ew-resize' | 'nesw-resize' | 'nwse-resize';

export type SpacingDragInput = {
  start: BoxQuad;
  dx: number;
  dy: number;
  edge?: SpacingEdge | null;
  min?: number;
  snap?: boolean;
  inward?: boolean;
  mirror?: boolean;
};

const SNAP_GRID = 5;
const SNAP_EDGE_RANGE = 10;
const ZERO_RESIST = 20;

const OPPOSITE: Record<SpacingEdge, SpacingEdge> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const ADJACENT: Record<SpacingEdge, [SpacingEdge, SpacingEdge]> = {
  top: ['left', 'right'],
  bottom: ['left', 'right'],
  left: ['top', 'bottom'],
  right: ['top', 'bottom'],
};

const CORNER_INWARD: Record<SpacingEdge, { x: number; y: number }> = {
  top: { x: 1, y: 1 },
  right: { x: -1, y: 1 },
  bottom: { x: -1, y: -1 },
  left: { x: 1, y: -1 },
};

export function isBoxDragKind(value: string | null | undefined): value is BoxDragKind {
  return (
    value === 'padding' ||
    value === 'margin' ||
    value === 'radius' ||
    value === 'size' ||
    value === 'position' ||
    value === 'rotate'
  );
}

export function spacingHandleCursor(kind: BoxDragKind, edge: SpacingEdge): SpacingCursor {
  if (kind === 'rotate') {
    return 'ns-resize';
  }
  if (kind === 'radius') {
    return edge === 'top' || edge === 'bottom' ? 'nwse-resize' : 'nesw-resize';
  }
  return edge === 'left' || edge === 'right' ? 'ew-resize' : 'ns-resize';
}

export function spacingCursorClass(cursor: SpacingCursor) {
  if (cursor === 'nwse-resize') {
    return 'is-cursor-nwse';
  }
  if (cursor === 'nesw-resize') {
    return 'is-cursor-nesw';
  }
  if (cursor === 'ew-resize') {
    return 'is-cursor-ew';
  }
  return 'is-cursor-ns';
}

function resistNegative(from: number, next: number) {
  if (next >= 0 || from < 0) {
    return next;
  }
  if (-next <= ZERO_RESIST) {
    return 0;
  }
  return next + ZERO_RESIST;
}

function addEdge(start: number | undefined, delta: number, min?: number) {
  if (delta === 0 && start == null) {
    return start;
  }
  const next = (start ?? 0) + delta;
  if (min != null && next < min) {
    return min;
  }
  return next;
}

function edgeValue(quad: BoxQuad, edge: SpacingEdge) {
  return quad[edge] ?? 0;
}

function nearestInRange(raw: number, targets: number[], range: number) {
  let best: number | null = null;
  let bestDist = range;
  for (const target of targets) {
    const dist = Math.abs(raw - target);
    if (dist <= bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return best;
}

const DIGIT_EDGES: Record<string, SpacingEdge[]> = {
  '1': ['top'],
  '2': ['right'],
  '3': ['bottom'],
  '4': ['left'],
  '5': ['top', 'bottom'],
  '6': ['left', 'right'],
  '7': ['top', 'right', 'bottom', 'left'],
};

const SIZE_DIGIT_EDGES: Record<string, SpacingEdge[]> = {
  '1': ['left', 'right'],
  '2': ['top', 'bottom'],
  '3': ['top', 'right', 'bottom', 'left'],
};

function selectDigitEdges(kind?: BoxDragKind | 'border' | null) {
  if (kind === 'rotate') {
    return {};
  }
  return kind === 'size' ? SIZE_DIGIT_EDGES : DIGIT_EDGES;
}

const NUMPAD_DIGIT = /^Numpad([0-9])$/;
export const SPACING_VALUE_MAX_DIGITS = 4;
export const SPACING_NUDGE_REPEAT_MS = 100;
export const SPACING_NUDGE_REPEAT_STEP = 2;

export function spacingSelectKey(
  key: string,
  code?: string,
  kind?: BoxDragKind | 'border' | null,
): string | null {
  if (code?.startsWith('Numpad') || !(key in selectDigitEdges(kind))) {
    return null;
  }
  return key;
}

export function spacingEdgesFromSelectKey(key: string, kind?: BoxDragKind | 'border' | null): SpacingEdge[] {
  return selectDigitEdges(kind)[key] ?? [];
}

export function spacingEdgesFromSelectKeys(
  keys: Iterable<string>,
  kind?: BoxDragKind | 'border' | null,
): SpacingEdge[] {
  const held = new Set<SpacingEdge>();
  for (const key of keys) {
    for (const edge of spacingEdgesFromSelectKey(key, kind)) {
      held.add(edge);
    }
  }
  return SPACING_EDGES.filter((edge) => held.has(edge));
}

export function spacingEdgeFromDigit(
  key: string,
  code?: string,
  kind?: BoxDragKind | 'border' | null,
): SpacingEdge | null {
  const edges = spacingSelectKey(key, code, kind) ? spacingEdgesFromSelectKey(key, kind) : [];
  return edges.length === 1 ? edges[0] : null;
}

export function spacingDigitFromNumpad(code?: string, key?: string): string | null {
  if (!code || key == null) {
    return null;
  }
  const match = NUMPAD_DIGIT.exec(code);
  if (!match || key !== match[1]) {
    return null;
  }
  return match[1];
}

export function spacingNudgeFromArrow(key: string, allSelected = false, step = 1): number | null {
  if (key === 'ArrowUp' || (allSelected && key === 'ArrowRight')) {
    return step;
  }
  if (key === 'ArrowDown' || (allSelected && key === 'ArrowLeft')) {
    return -step;
  }
  return null;
}

export function isSpacingSignKey(key: string, code?: string) {
  return key === '-' || code === 'Minus' || code === 'NumpadSubtract';
}

export function isSpacingValueKey(key: string, code?: string) {
  return Boolean(spacingDigitFromNumpad(code, key)) || key === 'Backspace' || isSpacingSignKey(key, code);
}

export function isSpacingNudgeKey(key: string, code?: string, kind?: BoxDragKind | 'border' | null) {
  if (kind === 'rotate') {
    return isRotateNudgeKey(key, code);
  }
  return (
    Boolean(spacingSelectKey(key, code, kind)) ||
    isSpacingValueKey(key, code) ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight'
  );
}

export function applySpacingNudge(
  start: BoxQuad,
  edges: SpacingEdge[],
  delta: number,
  min?: number,
): BoxQuad {
  const next = { ...start };
  for (const edge of edges) {
    const value = (next[edge] ?? 0) + delta;
    next[edge] = min != null && value < min ? min : value;
  }
  return next;
}

export function applySpacingValue(
  start: BoxQuad,
  edges: SpacingEdge[],
  value: number,
  min?: number,
): BoxQuad {
  const next = { ...start };
  const clamped = min != null && value < min ? min : Math.trunc(value);
  for (const edge of edges) {
    next[edge] = clamped;
  }
  return next;
}

export function oppositeSpacingEdge(edge: SpacingEdge) {
  return OPPOSITE[edge];
}

export function snapSpacingValue(
  raw: number,
  edge: SpacingEdge,
  quad: BoxQuad,
  min?: number,
  options?: { skipOpposite?: boolean; skipEdges?: boolean },
) {
  if (!options?.skipEdges) {
    if (!options?.skipOpposite) {
      const opposite = nearestInRange(raw, [edgeValue(quad, OPPOSITE[edge])], SNAP_EDGE_RANGE);
      if (opposite != null && (min == null || opposite >= min)) {
        return opposite;
      }
    }
    const adjacent = nearestInRange(
      raw,
      ADJACENT[edge].flatMap((item) => {
        const value = quad[item];
        return value == null ? [] : [value];
      }),
      SNAP_EDGE_RANGE,
    );
    if (adjacent != null && (min == null || adjacent >= min)) {
      return adjacent;
    }
  }
  const grid = Math.round(raw / SNAP_GRID) * SNAP_GRID;
  if (min != null && grid < min) {
    return min;
  }
  return grid;
}

export function pickSpacingEdge(dx: number, dy: number): SpacingEdge | null {
  const x = Math.round(dx);
  const y = Math.round(dy);
  if (x === 0 && y === 0) {
    return null;
  }
  if (Math.abs(x) >= Math.abs(y)) {
    return x >= 0 ? 'right' : 'left';
  }
  return y >= 0 ? 'bottom' : 'top';
}

function axisDelta(edge: SpacingEdge, x: number, y: number) {
  if (edge === 'right') {
    return x;
  }
  if (edge === 'left') {
    return -x;
  }
  if (edge === 'bottom') {
    return y;
  }
  return -y;
}

function writeEdge(start: BoxQuad, edge: SpacingEdge, delta: number, min?: number, snap?: boolean, mirror?: boolean) {
  const from = edgeValue(start, edge);
  const raw = addEdge(start[edge], delta, min);
  if (raw == null) {
    return start[edge];
  }
  const next = Math.trunc(resistNegative(from, raw));
  return snap ? snapSpacingValue(next, edge, start, min, { skipOpposite: mirror }) : next;
}

export function applySpacingDrag({ start, dx, dy, edge, min, snap, inward, mirror }: SpacingDragInput): BoxQuad {
  const locked = edge ?? pickSpacingEdge(dx, dy);
  if (!locked) {
    return start;
  }
  const x = Math.trunc(inward ? -dx : dx);
  const y = Math.trunc(inward ? -dy : dy);
  const delta = axisDelta(locked, x, y);
  const nextValue = writeEdge(start, locked, delta, min, snap, mirror);
  const next = { ...start, [locked]: nextValue };
  if (mirror) {
    next[OPPOSITE[locked]] = nextValue ?? 0;
  }
  return next;
}

export function uniqueSizeEdges(edges: SpacingEdge[]): SpacingEdge[] {
  const next: SpacingEdge[] = [];
  if (edges.some((edge) => edge === 'left' || edge === 'right')) {
    next.push('right');
  }
  if (edges.some((edge) => edge === 'top' || edge === 'bottom')) {
    next.push('top');
  }
  return next;
}

export function syncSizeQuad(quad: BoxQuad): BoxQuad {
  const width = quad.right ?? quad.left;
  const height = quad.top ?? quad.bottom;
  return { top: height, right: width, bottom: height, left: width };
}

export function applySizeDrag({
  start,
  dx,
  dy,
  edge,
  snap,
  mirror,
}: Pick<SpacingDragInput, 'start' | 'dx' | 'dy' | 'edge' | 'snap' | 'mirror'>): BoxQuad {
  const locked = edge ?? pickSpacingEdge(dx, dy);
  if (!locked) {
    return start;
  }
  const horizontal = locked === 'left' || locked === 'right';
  const from = horizontal ? (start.right ?? start.left ?? 0) : (start.top ?? start.bottom ?? 0);
  const raw = Math.max(0, from + axisDelta(locked, Math.trunc(dx), Math.trunc(dy)));
  const nextValue = snap
    ? snapSpacingValue(Math.trunc(raw), locked, start, 0, { skipOpposite: true, skipEdges: mirror })
    : Math.trunc(raw);
  if (mirror) {
    return { top: nextValue, right: nextValue, bottom: nextValue, left: nextValue };
  }
  if (horizontal) {
    return { ...start, left: nextValue, right: nextValue };
  }
  return { ...start, top: nextValue, bottom: nextValue };
}

function cornerDelta(edge: SpacingEdge, dx: number, dy: number) {
  const sign = CORNER_INWARD[edge];
  return Math.trunc((dx * sign.x + dy * sign.y) / Math.SQRT2);
}

export function applyRadiusDrag({
  start,
  dx,
  dy,
  edge,
  snap,
  mirror,
}: Pick<SpacingDragInput, 'start' | 'dx' | 'dy' | 'edge' | 'snap' | 'mirror'>): BoxQuad {
  const locked = edge ?? pickSpacingEdge(dx, dy);
  if (!locked) {
    return start;
  }
  const raw = Math.max(0, (start[locked] ?? 0) + cornerDelta(locked, Math.trunc(dx), Math.trunc(dy)));
  const nextValue = snap
    ? snapSpacingValue(Math.trunc(raw), locked, start, 0, { skipOpposite: true, skipEdges: mirror })
    : Math.trunc(raw);
  if (mirror) {
    return { top: nextValue, right: nextValue, bottom: nextValue, left: nextValue };
  }
  return { ...start, [locked]: nextValue };
}
