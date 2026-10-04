import type { CSSProperties } from 'react';
import {
  angleCss,
  boxLengthCss,
  isCopyBinding,
  resolveCopyBinding,
  type AngleValue,
  type BindingScope,
  type BoxLength,
  type FlexContainerStyle,
  type FlexItemStyle,
  type PageStyle,
  type PageWidget,
  type SizeValue,
  type TableLine,
  type WidgetStyle,
} from '@vanstack/xml';

export type WidgetCssOptions = {
  animate?: boolean;
  evaluateBindings?: boolean;
  bindingScope?: BindingScope;
};

function cssText(raw: string | undefined, options?: WidgetCssOptions): string | undefined {
  if (!raw) {
    return undefined;
  }
  if (!isCopyBinding(raw)) {
    return raw;
  }
  if (!options?.evaluateBindings) {
    return undefined;
  }
  const resolved = resolveCopyBinding(raw, options.bindingScope ?? { data: Object.create(null) as Record<string, unknown> });
  return resolved || undefined;
}

function cssMeasure(value: number | string | undefined, options?: WidgetCssOptions, unit = 'px'): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}${unit}`;
  }
  const text = cssText(typeof value === 'string' ? value : undefined, options);
  if (!text) {
    return undefined;
  }
  return /^-?\d+(?:\.\d+)?$/.test(text) ? `${text}${unit}` : text;
}

function cssUnitless(value: number | string | undefined, options?: WidgetCssOptions): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const text = cssText(typeof value === 'string' ? value : undefined, options);
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : text;
}

function cssOn(value: boolean | string | undefined, options?: WidgetCssOptions): boolean {
  if (typeof value !== 'string') {
    return Boolean(value);
  }
  const text = cssText(value, options);
  return text === 'true' || text === '1' || text === 'yes';
}

function cssBox(length: BoxLength | string | undefined, options?: WidgetCssOptions): string | undefined {
  if (length == null) {
    return undefined;
  }
  if (typeof length !== 'string') {
    return boxLengthCss(length);
  }
  const text = cssText(length, options);
  if (!text) {
    return undefined;
  }
  if (text === 'auto' || /^-?\d+(?:\.\d+)?(?:px|%)$/.test(text)) {
    return text;
  }
  return /^-?\d+(?:\.\d+)?$/.test(text) ? `${text}px` : text;
}

function cssAngleValue(angle: AngleValue | string | undefined, options?: WidgetCssOptions): string | undefined {
  if (angle == null) {
    return undefined;
  }
  if (typeof angle !== 'string') {
    return angleCss(angle);
  }
  const text = cssText(angle, options);
  if (!text) {
    return undefined;
  }
  if (/^-?\d+(?:\.\d+)?(?:deg|rad|grad|turn)$/i.test(text)) {
    return text;
  }
  return /^-?\d+(?:\.\d+)?$/.test(text) ? `${text}deg` : text;
}

export function sizeCss(size: SizeValue | string | undefined, options?: WidgetCssOptions): string {
  if (typeof size === 'string') {
    const text = cssText(size, options);
    if (!text) {
      return 'fit-content';
    }
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      return `${text}px`;
    }
    return text;
  }
  if (!size) {
    return 'fit-content';
  }
  return size.mode === '%' ? `${size.value}%` : `${size.value}px`;
}

export function mergeCss(...parts: Array<CSSProperties | undefined>): CSSProperties | undefined {
  const css: CSSProperties = {};
  for (const part of parts) {
    if (part) {
      Object.assign(css, part);
    }
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

export function hiddenCss(hidden: boolean | undefined, editing: boolean): CSSProperties | undefined {
  return hidden && editing ? { visibility: 'hidden' } : undefined;
}

export function pageCss(style: PageStyle | undefined, editing = false, options?: WidgetCssOptions): CSSProperties {
  const overflow = editing ? 'visible' : (cssText(style?.overflow, options) ?? 'auto');
  const css: CSSProperties = {
    boxSizing: 'border-box',
    position: 'relative',
    perspective: 800,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    overflow: overflow as CSSProperties['overflow'],
  };
  const background = cssText(style?.background, options);
  if (background) {
    css.background = background;
  }
  const paddingTop = cssMeasure(style?.paddingTop, options);
  if (paddingTop) {
    css.paddingTop = paddingTop;
  }
  const paddingRight = cssMeasure(style?.paddingRight, options);
  if (paddingRight) {
    css.paddingRight = paddingRight;
  }
  const paddingBottom = cssMeasure(style?.paddingBottom, options);
  if (paddingBottom) {
    css.paddingBottom = paddingBottom;
  }
  const paddingLeft = cssMeasure(style?.paddingLeft, options);
  if (paddingLeft) {
    css.paddingLeft = paddingLeft;
  }
  return css;
}

export function widgetCss(style: WidgetStyle | undefined, options?: WidgetCssOptions): CSSProperties | undefined {
  if (!style) {
    return { width: 'fit-content', height: 'fit-content' };
  }

  const css: CSSProperties = {};
  const color = cssText(style.color, options);
  if (color) {
    css.color = color;
  }
  const textShadow = cssText(style.textShadow, options);
  if (textShadow) {
    css.textShadow = textShadow;
  }
  if (style.italic != null) {
    css.fontStyle = cssOn(typeof style.italic === 'string' && !isCopyBinding(style.italic) ? style.italic === 'italic' : style.italic, options)
      ? 'italic'
      : 'normal';
  }
  if (style.fontFamily) {
    const fontFamily = cssText(style.fontFamily, options);
    if (fontFamily) {
      css.fontFamily = fontFamily;
    }
  }
  const fontSize = cssMeasure(style.fontSize, options);
  if (fontSize) {
    css.fontSize = fontSize;
  }
  if (style.fontWeight) {
    const fontWeight = cssText(style.fontWeight, options);
    if (fontWeight) {
      css.fontWeight = fontWeight;
    }
  }

  if (style.underline != null || style.lineThrough != null) {
    const decorations: string[] = [];
    if (cssOn(style.underline, options)) {
      decorations.push('underline');
    }
    if (cssOn(style.lineThrough, options)) {
      decorations.push('line-through');
    }
    css.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
  }

  const background = cssText(style.background, options);
  if (background) {
    css.background = background;
  }

  const borderEdges = [
    {
      width: style.borderTopWidth,
      line: style.borderTopStyle || style.borderStyle,
      color: style.borderTopColor || style.borderColor,
      apply(width: string, line: string, color: string | undefined) {
        css.borderTopWidth = width;
        css.borderTopStyle = line as CSSProperties['borderTopStyle'];
        if (color) {
          css.borderTopColor = color;
        }
      },
    },
    {
      width: style.borderRightWidth,
      line: style.borderRightStyle || style.borderStyle,
      color: style.borderRightColor || style.borderColor,
      apply(width: string, line: string, color: string | undefined) {
        css.borderRightWidth = width;
        css.borderRightStyle = line as CSSProperties['borderRightStyle'];
        if (color) {
          css.borderRightColor = color;
        }
      },
    },
    {
      width: style.borderBottomWidth,
      line: style.borderBottomStyle || style.borderStyle,
      color: style.borderBottomColor || style.borderColor,
      apply(width: string, line: string, color: string | undefined) {
        css.borderBottomWidth = width;
        css.borderBottomStyle = line as CSSProperties['borderBottomStyle'];
        if (color) {
          css.borderBottomColor = color;
        }
      },
    },
    {
      width: style.borderLeftWidth,
      line: style.borderLeftStyle || style.borderStyle,
      color: style.borderLeftColor || style.borderColor,
      apply(width: string, line: string, color: string | undefined) {
        css.borderLeftWidth = width;
        css.borderLeftStyle = line as CSSProperties['borderLeftStyle'];
        if (color) {
          css.borderLeftColor = color;
        }
      },
    },
  ];
  const borderActive = borderEdges.some((edge) => edge.width != null || edge.line || edge.color);
  if (borderActive) {
    for (const edge of borderEdges) {
      const color = cssText(edge.color, options);
      const active = edge.width != null || Boolean(edge.line) || Boolean(color);
      if (!active) {
        edge.apply('0px', 'solid', undefined);
        continue;
      }
      edge.apply(cssMeasure(edge.width ?? 1, options) || '1px', cssText(typeof edge.line === 'string' ? edge.line : undefined, options) || 'solid', color);
    }
  } else if (background) {
    css.border = 'none';
  }

  const radiusTopLeft = cssMeasure(style.radiusTopLeft, options);
  if (radiusTopLeft) {
    css.borderTopLeftRadius = radiusTopLeft;
  }
  const radiusTopRight = cssMeasure(style.radiusTopRight, options);
  if (radiusTopRight) {
    css.borderTopRightRadius = radiusTopRight;
  }
  const radiusBottomRight = cssMeasure(style.radiusBottomRight, options);
  if (radiusBottomRight) {
    css.borderBottomRightRadius = radiusBottomRight;
  }
  const radiusBottomLeft = cssMeasure(style.radiusBottomLeft, options);
  if (radiusBottomLeft) {
    css.borderBottomLeftRadius = radiusBottomLeft;
  }

  const boxShadow = cssText(style.boxShadow, options);
  if (boxShadow) {
    css.boxShadow = boxShadow;
  }

  css.width = sizeCss(style.width, options);
  css.height = sizeCss(style.height, options);
  const overflow = cssText(style.overflow, options);
  if (overflow) {
    css.overflow = overflow as CSSProperties['overflow'];
  }
  const position = cssText(style.position, options);
  if (position) {
    css.position = position as CSSProperties['position'];
    const top = cssBox(style.top, options);
    if (top) {
      css.top = top;
    }
    const right = cssBox(style.right, options);
    if (right) {
      css.right = right;
    }
    const bottom = cssBox(style.bottom, options);
    if (bottom) {
      css.bottom = bottom;
    }
    const left = cssBox(style.left, options);
    if (left) {
      css.left = left;
    }
    const zIndex = cssUnitless(style.zIndex, options);
    if (zIndex != null && zIndex !== '') {
      css.zIndex = zIndex as CSSProperties['zIndex'];
    }
  }
  const marginTop = cssBox(style.marginTop, options);
  if (marginTop) {
    css.marginTop = marginTop;
  }
  const marginRight = cssBox(style.marginRight, options);
  if (marginRight) {
    css.marginRight = marginRight;
  }
  const marginBottom = cssBox(style.marginBottom, options);
  if (marginBottom) {
    css.marginBottom = marginBottom;
  }
  const marginLeft = cssBox(style.marginLeft, options);
  if (marginLeft) {
    css.marginLeft = marginLeft;
  }
  const paddingTop = cssBox(style.paddingTop, options);
  if (paddingTop) {
    css.paddingTop = paddingTop;
  }
  const paddingRight = cssBox(style.paddingRight, options);
  if (paddingRight) {
    css.paddingRight = paddingRight;
  }
  const paddingBottom = cssBox(style.paddingBottom, options);
  if (paddingBottom) {
    css.paddingBottom = paddingBottom;
  }
  const paddingLeft = cssBox(style.paddingLeft, options);
  if (paddingLeft) {
    css.paddingLeft = paddingLeft;
  }

  const rotate: string[] = [];
  const rotateX = cssAngleValue(style.rotateX, options);
  if (rotateX) {
    rotate.push(`rotateX(${rotateX})`);
  }
  const rotateY = cssAngleValue(style.rotateY, options);
  if (rotateY) {
    rotate.push(`rotateY(${rotateY})`);
  }
  const rotateZ = cssAngleValue(style.rotateZ, options);
  if (rotateZ) {
    rotate.push(`rotateZ(${rotateZ})`);
  }
  if (rotate.length > 0) {
    css.transform = rotate.join(' ');
  }
  const motion = cssMeasure(style.transition, options, 'ms');
  if ((options?.animate ?? true) && motion && motion !== '0ms') {
    css.transition = `all ${motion}`;
  }

  return Object.keys(css).length > 0 ? css : undefined;
}

export function flexContainerCss(style: FlexContainerStyle | undefined, options?: WidgetCssOptions): CSSProperties {
  const css: CSSProperties = {
    display: (cssText(style?.display, options) ?? 'flex') as CSSProperties['display'],
  };
  const flexDirection = cssText(style?.flexDirection, options);
  if (flexDirection) {
    css.flexDirection = flexDirection as CSSProperties['flexDirection'];
  }
  const flexWrap = cssText(style?.flexWrap, options);
  if (flexWrap) {
    css.flexWrap = flexWrap as CSSProperties['flexWrap'];
  }
  const justifyContent = cssText(style?.justifyContent, options);
  if (justifyContent) {
    css.justifyContent = justifyContent as CSSProperties['justifyContent'];
  }
  const alignItems = cssText(style?.alignItems, options);
  if (alignItems) {
    css.alignItems = alignItems as CSSProperties['alignItems'];
  }
  const alignContent = cssText(style?.alignContent, options);
  if (alignContent) {
    css.alignContent = alignContent as CSSProperties['alignContent'];
  }
  const rowGap = cssMeasure(style?.rowGap, options);
  if (rowGap) {
    css.rowGap = rowGap;
  }
  const columnGap = cssMeasure(style?.columnGap, options);
  if (columnGap) {
    css.columnGap = columnGap;
  }
  return css;
}

export function flexItemCss(style: FlexItemStyle | undefined, options?: WidgetCssOptions): CSSProperties | undefined {
  if (!style) {
    return undefined;
  }

  const css: CSSProperties = {};
  const order = cssUnitless(style.order, options);
  if (typeof order === 'number') {
    css.order = order;
  }
  const flexGrow = cssUnitless(style.flexGrow, options);
  if (typeof flexGrow === 'number') {
    css.flexGrow = flexGrow;
  }
  const flexShrink = cssUnitless(style.flexShrink, options);
  if (typeof flexShrink === 'number') {
    css.flexShrink = flexShrink;
  }
  if (style.flexBasis === 'auto') {
    css.flexBasis = 'auto';
  } else {
    const flexBasis = cssMeasure(style.flexBasis, options);
    if (flexBasis) {
      css.flexBasis = flexBasis;
    }
  }
  const alignSelf = cssText(style.alignSelf, options);
  if (alignSelf) {
    css.alignSelf = alignSelf as CSSProperties['alignSelf'];
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

export function boxCss(style: WidgetStyle | undefined, options?: WidgetCssOptions): CSSProperties | undefined {
  const css = widgetCss(style, options);
  if (!css) {
    return undefined;
  }
  if (!style?.width) {
    delete css.width;
  }
  if (!style?.height) {
    delete css.height;
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

export function widgetClassName(id: string): string {
  return `lw-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function dynamicStyleCss(style: WidgetStyle | undefined, options?: WidgetCssOptions): CSSProperties | undefined {
  const css: CSSProperties = {};
  const transition = cssMeasure(style?.transition, options, 'ms');
  if ((options?.animate ?? true) && transition && transition !== '0ms') {
    css.transition = `all ${transition}`;
  }
  if (style) {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(style)) {
      if (typeof value === 'string' && isCopyBinding(value)) {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length > 0) {
      const bound = widgetCss(filtered as unknown as WidgetStyle, { ...options, animate: false }) ?? {};
      if (!('width' in filtered)) {
        delete bound.width;
      }
      if (!('height' in filtered)) {
        delete bound.height;
      }
      for (const key of Object.keys(bound)) {
        if (key.startsWith('border') && !(key in filtered)) {
          delete bound[key as keyof CSSProperties];
        }
      }
      Object.assign(css, bound);
    }
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

export function cssDeclarationText(css: CSSProperties): string | undefined {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(css)) {
    if (value == null || value === '') {
      continue;
    }
    const name = key.replace(/[A-Z]/g, (part) => `-${part.toLowerCase()}`);
    lines.push(`${name}: ${String(value)}`);
  }
  return lines.length > 0 ? lines.join('; ') : undefined;
}

function escapeStateId(id: string): string {
  return id.replace(/["\\]/g, '\\$&');
}

function styleRuleText(style: WidgetStyle | undefined, includeDefaults: boolean): string | undefined {
  if (!style && !includeDefaults) {
    return undefined;
  }
  const css = widgetCss(style, { animate: false, evaluateBindings: false }) ?? {};
  if (!includeDefaults) {
    if (style?.width == null) {
      delete css.width;
    }
    if (style?.height == null) {
      delete css.height;
    }
  }
  return cssDeclarationText(css);
}

function iconLayoutStyle(widget: PageWidget): WidgetStyle | undefined {
  if (widget.type !== 'icon') {
    return widget.style;
  }
  const size = typeof widget.size === 'number' && widget.size > 0 ? widget.size : 24;
  const boundSize = typeof widget.size === 'string' && isCopyBinding(widget.size) ? widget.size : undefined;
  if (widget.style?.width && widget.style.height) {
    return widget.style;
  }
  return {
    ...widget.style,
    width: widget.style?.width ?? boundSize ?? { mode: 'px', value: size },
    height: widget.style?.height ?? boundSize ?? { mode: 'px', value: size },
  };
}

function tableLineDeclaration(edge: 'bottom' | 'right', line: TableLine | undefined): string | undefined {
  if (!line) {
    return undefined;
  }
  const width = line.width != null && line.width > 0 ? line.width : line.style || line.color ? 1 : undefined;
  if (width == null) {
    return undefined;
  }
  const style = line.style || 'solid';
  const color = line.color && !isCopyBinding(line.color) && !/[;{}]/.test(line.color) ? line.color : undefined;
  if (color) {
    return `border-${edge}: ${width}px ${style} ${color}`;
  }
  return `border-${edge}-width: ${width}px; border-${edge}-style: ${style}`;
}

/** 表头底边、行间、列间写到表格类上，画在单元格盒内，盖住单元格背景。 */
function tableLineRules(cls: string, lines: { header?: TableLine; row?: TableLine; column?: TableLine } | undefined): string[] {
  if (!lines) {
    return [];
  }
  const rules: string[] = [];
  const header = tableLineDeclaration('bottom', lines.header);
  if (header) {
    rules.push(`.${cls} > .lowcode-table-head > [data-widget-type="th"] { ${header}; }`);
  }
  const row = tableLineDeclaration('bottom', lines.row);
  if (row) {
    rules.push(`.${cls} > [data-widget-type="tr"]:not(:last-child) > * { ${row}; }`);
  }
  const column = tableLineDeclaration('right', lines.column);
  if (column) {
    rules.push(
      `.${cls} > .lowcode-table-head > :not(:last-child), .${cls} > .lowcode-table-row > :not(:last-child) { ${column}; }`,
    );
  }
  return rules;
}

export function pageCssText(widgets: PageWidget[]): string {
  const blocks: string[] = [];

  function push(selector: string, style: WidgetStyle | undefined, includeDefaults: boolean) {
    const body = styleRuleText(style, includeDefaults);
    if (body) {
      blocks.push(`${selector} { ${body}; }`);
    }
  }

  function walk(list: PageWidget[]) {
    for (const widget of list) {
      const cls = widgetClassName(widget.id);
      for (const override of widget.stateOverrides ?? []) {
        const overrideId = escapeStateId(override.id);
        push(`[data-state~="${overrideId}"] .${cls}`, override.style, false);
        for (const nested of override.states ?? []) {
          push(
            `[data-state~="${overrideId}"] .${cls}[data-state~="${escapeStateId(nested.id)}"]`,
            nested.style,
            false,
          );
        }
      }
      const stretchTrack = widget.type === 'th' || widget.type === 'tr' || widget.type === 'td';
      push(`.${cls}`, iconLayoutStyle(widget), !stretchTrack);
      if (widget.type === 'table') {
        blocks.push(...tableLineRules(cls, widget.lines));
      }
      for (const state of widget.states ?? []) {
        push(`.${cls}[data-state~="${escapeStateId(state.id)}"]`, state.style, false);
      }
      if ('children' in widget) {
        walk(widget.children);
      }
    }
  }

  walk(widgets);
  blocks.push(
    '.lowcode-page > [data-widget-id] { flex: 0 0 auto; max-width: none; }',
    '.lowcode-table { scrollbar-width: none; }',
    '.lowcode-table::-webkit-scrollbar { width: 0; height: 0; display: none; }',
    '.lowcode-table-slot { display: flex; align-items: center; }',
    '.lowcode-dynamic-copy { cursor: help; }',
    '.lowcode-dynamic-copy-tip { position: fixed; z-index: 80; max-width: 360px; padding: 6px 8px; border-radius: 6px; background: rgba(21, 28, 34, 0.96); color: #fff; font: 12px/1.45 "Segoe UI", sans-serif; white-space: pre-wrap; word-break: break-all; pointer-events: none; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28); }',
    '.lowcode-table-slot > :where(.lowcode-icon, .lowcode-text, .lowcode-image, .lowcode-button, .lowcode-input, .lowcode-checkbox, .lowcode-switch) { vertical-align: middle; }',
  );
  return blocks.join('\n');
}
