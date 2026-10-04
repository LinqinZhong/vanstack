import { ColorPicker, InputNumber, Modal, Select } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import {
  boxLengthsEqual,
  compactBoxLength,
  isCopyBinding,
  type BoxLength,
  type BoxLengthMode,
} from '@vanstack/xml';

export type BoxQuad = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type LengthQuad = {
  top?: BoxLength;
  right?: BoxLength;
  bottom?: BoxLength;
  left?: BoxLength;
};

export type BorderEdge = 'top' | 'right' | 'bottom' | 'left';

export type BorderLineQuad = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

const BORDER_LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;

function sharedText(values: Array<string | undefined>) {
  if (values.some((value) => value !== values[0])) {
    return undefined;
  }
  return values[0];
}

function colorValue(value: string | undefined) {
  if (!value || isCopyBinding(value)) {
    return null;
  }
  return value;
}

function LineLock({
  bound,
  resetKey,
  children,
  onContinue,
}: {
  bound?: string;
  resetKey?: string;
  children: ReactNode;
  onContinue?: () => void;
}) {
  const { t } = useTranslation();
  const [released, setReleased] = useState(false);
  const locked = isCopyBinding(bound ?? '') && !released;

  useEffect(() => {
    setReleased(false);
  }, [resetKey, bound]);

  function confirm(event: { preventDefault(): void; stopPropagation(): void }) {
    event.preventDefault();
    event.stopPropagation();
    Modal.confirm({
      title: t('lowcode.styleBindingOverwrite'),
      onOk: () => {
        setReleased(true);
        onContinue?.();
      },
    });
  }

  return (
    <span className="widget-style-binding" data-bound={locked ? '' : undefined} onMouseDownCapture={locked ? confirm : undefined}>
      {children}
    </span>
  );
}

export function pxFromLength(length?: BoxLength): number | undefined {
  return length && length.mode !== 'auto' ? length.value : undefined;
}

export function pxLength(value?: number): BoxLength | undefined {
  return value == null ? undefined : { mode: 'px', value };
}

function asLength(value?: BoxLength | number): BoxLength | undefined {
  if (value == null) {
    return undefined;
  }
  return typeof value === 'number' ? { mode: 'px', value } : value;
}

function toLengthQuad(values: LengthQuad | BoxQuad): LengthQuad {
  return {
    top: asLength(values.top as BoxLength | number | undefined),
    right: asLength(values.right as BoxLength | number | undefined),
    bottom: asLength(values.bottom as BoxLength | number | undefined),
    left: asLength(values.left as BoxLength | number | undefined),
  };
}

function unifiedLength(values: LengthQuad) {
  const list = [values.top, values.right, values.bottom, values.left];
  const first = list[0];
  if (first == null || list.some((value) => !boxLengthsEqual(value, first))) {
    return undefined;
  }
  return first;
}

function pairedLength(a?: BoxLength, b?: BoxLength) {
  return a != null && boxLengthsEqual(a, b) ? a : undefined;
}

function asLengthAmount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function makeLength(mode: BoxLengthMode, value?: unknown): BoxLength | undefined {
  if (mode === 'auto') {
    return { mode: 'auto' };
  }
  const amount = asLengthAmount(value);
  if (amount == null) {
    return undefined;
  }
  return { mode, value: amount };
}

function EdgeRow({
  label,
  value,
  disabled,
  min,
  max,
  units,
  popupContainer,
  inherited,
  line,
  onChange,
}: {
  label: string;
  value?: BoxLength;
  disabled?: boolean;
  min?: number;
  max?: number;
  units: readonly BoxLengthMode[];
  popupContainer?: () => HTMLElement;
  inherited?: boolean;
  line?: ReactNode;
  onChange: (value: BoxLength | undefined) => void;
}) {
  const showUnits = units.length > 1;
  const mode: BoxLengthMode = value?.mode ?? 'px';
  const numeric = value && value.mode !== 'auto' ? value.value : undefined;
  const auto = mode === 'auto';

  return (
    <div className={`style-box-row${inherited ? ' is-inherited' : ''}`}>
      <span className="style-box-row-label">{label}</span>
      <InputNumber
        size="small"
        disabled={disabled || auto}
        min={min}
        max={max}
        changeOnBlur={false}
        value={auto ? undefined : numeric}
        onChange={(next) => onChange(makeLength(auto ? 'px' : mode, next))}
        onBlur={(event) => {
          if (auto) {
            return;
          }
          const raw = event.target instanceof HTMLInputElement ? event.target.value : '';
          onChange(makeLength(mode, raw.trim() === '' ? undefined : raw));
        }}
      />
      {showUnits ? (
        <Select
          size="small"
          disabled={disabled}
          value={value ? mode : 'px'}
          popupMatchSelectWidth={false}
          getPopupContainer={popupContainer ?? (() => document.body)}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(next: BoxLengthMode) => {
            if (next === 'auto') {
              onChange({ mode: 'auto' });
              return;
            }
            onChange(makeLength(next, numeric ?? 0));
          }}
          options={units.map((unit) => ({ value: unit, label: unit }))}
        />
      ) : null}
      {line}
    </div>
  );
}

function formatPreviewValue(value?: BoxLength | number) {
  const length = asLength(value);
  if (!length || length.mode === 'auto') {
    return 0;
  }
  return length.value;
}

function BoxPreview({
  values,
  kind,
  stroke,
}: {
  values: LengthQuad;
  kind: 'edges' | 'corners';
  stroke?: { color?: string; style?: string };
}) {
  const top = formatPreviewValue(values.top);
  const right = formatPreviewValue(values.right);
  const bottom = formatPreviewValue(values.bottom);
  const left = formatPreviewValue(values.left);
  const style: CSSProperties = {};

  if (kind === 'corners') {
    const cap = (value: number) => Math.min(value, 24);
    style.borderRadius = `${cap(top)}px ${cap(right)}px ${cap(bottom)}px ${cap(left)}px`;
  }

  if (stroke) {
    const color = stroke.color || undefined;
    const borderStyle = stroke.style || 'solid';
    const widths = {
      top: Math.min(top, 14),
      right: Math.min(right, 14),
      bottom: Math.min(bottom, 14),
      left: Math.min(left, 14),
    };
    const hasWidth = widths.top || widths.right || widths.bottom || widths.left;
    if (hasWidth) {
      style.borderTopWidth = widths.top;
      style.borderRightWidth = widths.right;
      style.borderBottomWidth = widths.bottom;
      style.borderLeftWidth = widths.left;
      style.borderStyle = borderStyle;
    }
    if (color) {
      style.borderColor = color;
      style.color = color;
    }
  }

  return (
    <div
      className={[
        'style-box-preview',
        kind === 'corners' ? 'is-corners' : '',
        stroke ? 'is-border' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden
    >
      {kind === 'edges' && !stroke ? (
        <>
          <span className="style-box-preview-top">{top}</span>
          <span className="style-box-preview-right">{right}</span>
          <span className="style-box-preview-bottom">{bottom}</span>
          <span className="style-box-preview-left">{left}</span>
        </>
      ) : null}
    </div>
  );
}

export function StyleBoxEdges({
  values,
  kind = 'edges',
  disabled,
  min,
  max,
  stroke,
  showPreview = true,
  units = ['px'],
  lengthKind = 'margin',
  popupContainer,
  ownKeys,
  edgeKeys,
  baseValues,
  lines,
  onLineChange,
  linePopup,
  onChange,
}: {
  resetKey?: string;
  values: LengthQuad | BoxQuad;
  kind?: 'edges' | 'corners';
  disabled?: boolean;
  min?: number;
  max?: number;
  stroke?: { color?: string; style?: string };
  showPreview?: boolean;
  units?: readonly BoxLengthMode[];
  lengthKind?: 'margin' | 'padding' | 'inset';
  popupContainer?: () => HTMLElement;
  ownKeys?: Set<string>;
  edgeKeys?: { top?: string; right?: string; bottom?: string; left?: string };
  baseValues?: LengthQuad | BoxQuad;
  lines?: { style: BorderLineQuad; color: BorderLineQuad };
  onLineChange?: (lines: { style: BorderLineQuad; color: BorderLineQuad }) => void;
  linePopup?: (id: string) => { open: boolean; onOpenChange: (open: boolean) => void };
  onChange: (values: LengthQuad) => void;
}) {
  const { t } = useTranslation();
  const current = toLengthQuad(values);
  const numericOnly = units.length <= 1 && units[0] === 'px';

  const edgeInherited = (edge: 'top' | 'right' | 'bottom' | 'left'): boolean => {
    if (!ownKeys || !edgeKeys || !baseValues) return false;
    const key = edgeKeys[edge];
    if (!key || ownKeys.has(key)) return false;
    const base = baseValues[edge];
    return base != null;
  };
  const topInh = edgeInherited('top');
  const rightInh = edgeInherited('right');
  const bottomInh = edgeInherited('bottom');
  const leftInh = edgeInherited('left');
  const allInh = topInh && rightInh && bottomInh && leftInh;
  const verticalInh = topInh && bottomInh;
  const horizontalInh = leftInh && rightInh;
  const rowInherited: Record<string, boolean> = {
    all: allInh,
    vertical: verticalInh,
    horizontal: horizontalInh,
    top: topInh,
    left: leftInh,
    bottom: bottomInh,
    right: rightInh,
  };

  function emit(next: LengthQuad) {
    const compact = {
      top: compactBoxLength(next.top, lengthKind),
      right: compactBoxLength(next.right, lengthKind),
      bottom: compactBoxLength(next.bottom, lengthKind),
      left: compactBoxLength(next.left, lengthKind),
    };
    onChange(compact);
  }

  function writeAll(value: BoxLength | undefined) {
    emit({ top: value, right: value, bottom: value, left: value });
  }

  function writeHorizontal(value: BoxLength | undefined) {
    emit({ ...current, left: value, right: value });
  }

  function writeVertical(value: BoxLength | undefined) {
    emit({ ...current, top: value, bottom: value });
  }

  const labels =
    kind === 'corners'
      ? {
          all: t('lowcode.styleEdgeAll'),
          horizontal: t('lowcode.styleEdgeHorizontal'),
          vertical: t('lowcode.styleEdgeVertical'),
          top: t('lowcode.styleCornerTopLeft'),
          right: t('lowcode.styleCornerTopRight'),
          bottom: t('lowcode.styleCornerBottomRight'),
          left: t('lowcode.styleCornerBottomLeft'),
        }
      : {
          all: t('lowcode.styleEdgeAll'),
          horizontal: t('lowcode.styleEdgeHorizontal'),
          vertical: t('lowcode.styleEdgeVertical'),
          top: t('lowcode.styleEdgeTop'),
          left: t('lowcode.styleEdgeLeft'),
          bottom: t('lowcode.styleEdgeBottom'),
          right: t('lowcode.styleEdgeRight'),
        };

  const rows: Array<{
    key: string;
    label: string;
    value?: BoxLength;
    onChange: (value: BoxLength | undefined) => void;
    inherited: boolean;
  }> = [
    { key: 'all', label: labels.all, value: unifiedLength(current), onChange: writeAll, inherited: rowInherited.all },
    {
      key: 'vertical',
      label: labels.vertical,
      value: pairedLength(current.top, current.bottom),
      onChange: writeVertical,
      inherited: rowInherited.vertical,
    },
    {
      key: 'horizontal',
      label: labels.horizontal,
      value: pairedLength(current.left, current.right),
      onChange: writeHorizontal,
      inherited: rowInherited.horizontal,
    },
    { key: 'top', label: labels.top, value: current.top, onChange: (value) => emit({ ...current, top: value }), inherited: rowInherited.top },
    { key: 'left', label: labels.left, value: current.left, onChange: (value) => emit({ ...current, left: value }), inherited: rowInherited.left },
    {
      key: 'bottom',
      label: labels.bottom,
      value: current.bottom,
      onChange: (value) => emit({ ...current, bottom: value }),
      inherited: rowInherited.bottom,
    },
    { key: 'right', label: labels.right, value: current.right, onChange: (value) => emit({ ...current, right: value }), inherited: rowInherited.right },
  ];

  const rowSides: Record<string, BorderEdge[]> = {
    all: ['top', 'right', 'bottom', 'left'],
    vertical: ['top', 'bottom'],
    horizontal: ['left', 'right'],
    top: ['top'],
    left: ['left'],
    bottom: ['bottom'],
    right: ['right'],
  };

  function writeLines(sides: BorderEdge[], kindName: 'style' | 'color', value: string | undefined) {
    if (!lines || !onLineChange) {
      return;
    }
    const next = {
      style: { ...lines.style },
      color: { ...lines.color },
    };
    for (const side of sides) {
      next[kindName][side] = value;
    }
    onLineChange(next);
  }

  return (
    <div className={`style-box-edges is-rows${numericOnly ? ' is-px-only' : ''}${lines ? ' has-lines' : ''}`}>
      {showPreview ? <BoxPreview values={current} kind={kind} stroke={stroke} /> : null}
      {rows.map((row) => {
        const sides = rowSides[row.key] ?? [];
        const lineStyle = lines ? sharedText(sides.map((side) => lines.style[side])) : undefined;
        const lineColor = lines ? sharedText(sides.map((side) => lines.color[side])) : undefined;
        return (
          <EdgeRow
            key={row.key}
            label={row.label}
            value={row.value}
            disabled={disabled}
            min={min}
            max={max}
            units={units}
            popupContainer={popupContainer}
            inherited={row.inherited}
            onChange={row.onChange}
            line={
              lines && onLineChange ? (
                <>
                  <Select
                    size="small"
                    allowClear
                    disabled={disabled}
                    value={lineStyle === 'solid' || lineStyle === 'dashed' || lineStyle === 'dotted' ? lineStyle : undefined}
                    placeholder={t('lowcode.styleBorderNone')}
                    popupMatchSelectWidth={false}
                    getPopupContainer={popupContainer ?? (() => document.body)}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(value: (typeof BORDER_LINE_STYLES)[number] | null) =>
                      writeLines(sides, 'style', value || undefined)
                    }
                    options={BORDER_LINE_STYLES.map((value) => ({
                      value,
                      label: t(`lowcode.styleBorder${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                    }))}
                  />
                  <LineLock
                    bound={lineColor && isCopyBinding(lineColor) ? lineColor : undefined}
                    resetKey={`${row.key}:${lineColor ?? ''}`}
                    onContinue={() => linePopup?.(`${row.key}-color`)?.onOpenChange(true)}
                  >
                    <ColorPicker
                      size="small"
                      allowClear
                      disabled={disabled}
                      destroyOnHidden
                      value={colorValue(lineColor)}
                      getPopupContainer={popupContainer ?? (() => document.body)}
                      {...linePopup?.(`${row.key}-color`)}
                      onChange={(value, css) => writeLines(sides, 'color', value.cleared ? undefined : css)}
                    />
                  </LineLock>
                </>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}
