import {
  compactAngle,
  convertAngle,
  type AngleUnit,
  type AngleValue,
} from '@vanstack/xml';

export type RotateAxis = 'x' | 'y' | 'z';
export const ROTATE_AXES: RotateAxis[] = ['x', 'y', 'z'];
export type RotateTriple = {
  x?: AngleValue;
  y?: AngleValue;
  z?: AngleValue;
};

const DIGIT_AXES: Record<string, RotateAxis> = {
  '1': 'z',
  '2': 'x',
  '3': 'y',
};

const NUMPAD_DIGIT = /^Numpad([0-9])$/;
export const ROTATE_VALUE_MAX_CHARS = 10;

export function rotateSelectKey(key: string, code?: string): string | null {
  if (code?.startsWith('Numpad') || !(key in DIGIT_AXES)) {
    return null;
  }
  return key;
}

export function rotateAxisFromSelectKey(key: string): RotateAxis | null {
  return DIGIT_AXES[key] ?? null;
}

export function rotateAxesFromSelectKeys(keys: Iterable<string>): RotateAxis[] {
  const held = new Set<RotateAxis>();
  for (const key of keys) {
    const axis = rotateAxisFromSelectKey(key);
    if (axis) {
      held.add(axis);
    }
  }
  return ROTATE_AXES.filter((axis) => held.has(axis));
}

export function rotateStep(unit: AngleUnit, repeat = false): number {
  if (unit === 'rad' || unit === 'turn') {
    return repeat ? 0.02 : 0.01;
  }
  return repeat ? 2 : 1;
}

export function rotateQuantize(value: number, unit: AngleUnit): number {
  if (unit === 'rad' || unit === 'turn') {
    return Math.trunc(value * 100) / 100;
  }
  return Math.trunc(value);
}

export function rotateNudgeFromArrow(key: string, step: number): number | null {
  if (key === 'ArrowUp') {
    return step;
  }
  if (key === 'ArrowDown') {
    return -step;
  }
  return null;
}

export function isRotateDecimalKey(key: string, code?: string) {
  return key === '.' || code === 'Period' || code === 'NumpadDecimal';
}

export function isRotateValueKey(key: string, code?: string) {
  return Boolean(rotateDigitFromNumpad(code, key)) || key === 'Backspace' || isRotateSignKey(key, code) || isRotateDecimalKey(key, code);
}

export function isRotateSignKey(key: string, code?: string) {
  return key === '-' || code === 'Minus' || code === 'NumpadSubtract';
}

export function rotateDigitFromNumpad(code?: string, key?: string): string | null {
  if (!code || key == null) {
    return null;
  }
  const match = NUMPAD_DIGIT.exec(code);
  if (!match || key !== match[1]) {
    return null;
  }
  return match[1];
}

export function isRotateNudgeKey(key: string, code?: string) {
  return (
    Boolean(rotateSelectKey(key, code)) ||
    isRotateValueKey(key, code) ||
    key === 'ArrowUp' ||
    key === 'ArrowDown'
  );
}

export function pointerAngleDeg(x: number, y: number, cx: number, cy: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

export function shortestAngleDelta(from: number, to: number) {
  let delta = to - from;
  while (delta > 180) {
    delta -= 360;
  }
  while (delta < -180) {
    delta += 360;
  }
  return delta;
}

function snapTo15Deg(angle: AngleValue): AngleValue {
  const deg = convertAngle(angle, 'deg').value;
  const snapped = Math.round(deg / 15) * 15;
  const converted = convertAngle({ value: snapped, unit: 'deg' }, angle.unit);
  return { value: rotateQuantize(converted.value, converted.unit), unit: converted.unit };
}

function degDeltaInUnit(deltaDeg: number, unit: AngleUnit): number {
  return convertAngle({ value: deltaDeg, unit: 'deg' }, unit).value;
}

export function styleRotateTriple(style?: { rotateX?: AngleValue; rotateY?: AngleValue; rotateZ?: AngleValue }): RotateTriple {
  return {
    x: style?.rotateX,
    y: style?.rotateY,
    z: style?.rotateZ,
  };
}

export function writeRotateStyle<T extends { rotateX?: AngleValue; rotateY?: AngleValue; rotateZ?: AngleValue }>(
  style: T | undefined,
  triple: RotateTriple,
): T {
  return {
    ...(style as T),
    rotateX: triple.x,
    rotateY: triple.y,
    rotateZ: triple.z,
  };
}

function applyAxisValue(start: AngleValue | undefined, nextValue: number, snap: boolean): AngleValue | undefined {
  const unit = start?.unit ?? 'deg';
  let next: AngleValue = { value: nextValue, unit };
  if (snap) {
    next = snapTo15Deg(next);
  } else {
    next = { value: rotateQuantize(next.value, unit), unit };
  }
  return compactAngle(next);
}

export function applyRotateNudge(start: RotateTriple, axes: RotateAxis[], direction: 1 | -1, repeat = false): RotateTriple {
  const next = { ...start };
  for (const axis of axes) {
    const current = start[axis];
    const unit = current?.unit ?? 'deg';
    const step = rotateStep(unit, repeat) * direction;
    next[axis] = applyAxisValue(current, (current?.value ?? 0) + step, false);
  }
  return next;
}

export function applyRotateValue(start: RotateTriple, axes: RotateAxis[], value: number): RotateTriple {
  const next = { ...start };
  for (const axis of axes) {
    const unit = start[axis]?.unit ?? 'deg';
    next[axis] = compactAngle({ value: rotateQuantize(value, unit), unit });
  }
  return next;
}

export function applyRotateDrag(input: {
  start: RotateTriple;
  axis: RotateAxis;
  dx: number;
  dy: number;
  angleDeltaDeg?: number;
  snap?: boolean;
}): RotateTriple {
  const unit = input.start[input.axis]?.unit ?? 'deg';
  const from = input.start[input.axis]?.value ?? 0;
  let delta: number;
  if (input.axis === 'z') {
    delta = degDeltaInUnit(input.angleDeltaDeg ?? 0, unit);
  } else if (input.axis === 'x') {
    delta = degDeltaInUnit(-input.dy, unit);
  } else {
    delta = degDeltaInUnit(input.dx, unit);
  }
  const next = { ...input.start };
  next[input.axis] = applyAxisValue(input.start[input.axis], from + delta, Boolean(input.snap));
  return next;
}
