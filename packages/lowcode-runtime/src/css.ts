import type { CSSProperties } from 'react';
import {
  angleCss,
  boxLengthCss,
  isCopyBinding,
  resolveCopyBinding,
  type BindingScope,
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

export function sizeCss(size: SizeValue | undefined): string {
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

export function pageCss(style: PageStyle | undefined): CSSProperties {
  const css: CSSProperties = { boxSizing: 'border-box', position: 'relative', perspective: 800 };
  if (style?.background) {
    css.background = style.background;
  }
  if (style?.paddingTop != null) {
    css.paddingTop = `${style.paddingTop}px`;
  }
  if (style?.paddingRight != null) {
    css.paddingRight = `${style.paddingRight}px`;
  }
  if (style?.paddingBottom != null) {
    css.paddingBottom = `${style.paddingBottom}px`;
  }
  if (style?.paddingLeft != null) {
    css.paddingLeft = `${style.paddingLeft}px`;
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
    css.fontStyle = style.italic ? 'italic' : 'normal';
  }
  if (style.fontFamily) {
    const fontFamily = cssText(style.fontFamily, options);
    if (fontFamily) {
      css.fontFamily = fontFamily;
    }
  }
  if (style.fontSize != null) {
    css.fontSize = `${style.fontSize}px`;
  }
  if (style.fontWeight) {
    const fontWeight = cssText(style.fontWeight, options);
    if (fontWeight) {
      css.fontWeight = fontWeight;
    }
  }

  if (style.underline != null || style.lineThrough != null) {
    const decorations: string[] = [];
    if (style.underline) {
      decorations.push('underline');
    }
    if (style.lineThrough) {
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
      edge.apply(`${edge.width ?? 1}px`, cssText(edge.line, options) || 'solid', color);
    }
  } else if (background) {
    css.border = 'none';
  }

  if (style.radiusTopLeft != null) {
    css.borderTopLeftRadius = `${style.radiusTopLeft}px`;
  }
  if (style.radiusTopRight != null) {
    css.borderTopRightRadius = `${style.radiusTopRight}px`;
  }
  if (style.radiusBottomRight != null) {
    css.borderBottomRightRadius = `${style.radiusBottomRight}px`;
  }
  if (style.radiusBottomLeft != null) {
    css.borderBottomLeftRadius = `${style.radiusBottomLeft}px`;
  }

  const boxShadow = cssText(style.boxShadow, options);
  if (boxShadow) {
    css.boxShadow = boxShadow;
  }

  css.width = sizeCss(style.width);
  css.height = sizeCss(style.height);
  if (style.overflow) {
    css.overflow = style.overflow;
  }
  if (style.position) {
    css.position = style.position;
    if (style.top) {
      css.top = boxLengthCss(style.top);
    }
    if (style.right) {
      css.right = boxLengthCss(style.right);
    }
    if (style.bottom) {
      css.bottom = boxLengthCss(style.bottom);
    }
    if (style.left) {
      css.left = boxLengthCss(style.left);
    }
    if (style.zIndex != null) {
      css.zIndex = style.zIndex;
    }
  }
  if (style.marginTop) {
    css.marginTop = boxLengthCss(style.marginTop);
  }
  if (style.marginRight) {
    css.marginRight = boxLengthCss(style.marginRight);
  }
  if (style.marginBottom) {
    css.marginBottom = boxLengthCss(style.marginBottom);
  }
  if (style.marginLeft) {
    css.marginLeft = boxLengthCss(style.marginLeft);
  }
  if (style.paddingTop) {
    css.paddingTop = boxLengthCss(style.paddingTop);
  }
  if (style.paddingRight) {
    css.paddingRight = boxLengthCss(style.paddingRight);
  }
  if (style.paddingBottom) {
    css.paddingBottom = boxLengthCss(style.paddingBottom);
  }
  if (style.paddingLeft) {
    css.paddingLeft = boxLengthCss(style.paddingLeft);
  }

  const rotate: string[] = [];
  if (style.rotateX) {
    rotate.push(`rotateX(${angleCss(style.rotateX)})`);
  }
  if (style.rotateY) {
    rotate.push(`rotateY(${angleCss(style.rotateY)})`);
  }
  if (style.rotateZ) {
    rotate.push(`rotateZ(${angleCss(style.rotateZ)})`);
  }
  if (rotate.length > 0) {
    css.transform = rotate.join(' ');
  }
  if ((options?.animate ?? true) && style.transition != null && style.transition > 0) {
    css.transition = `all ${style.transition}ms`;
  }

  return Object.keys(css).length > 0 ? css : undefined;
}

export function flexContainerCss(style: FlexContainerStyle | undefined): CSSProperties {
  const css: CSSProperties = {
    display: style?.display ?? 'flex',
  };
  if (style?.flexDirection) {
    css.flexDirection = style.flexDirection;
  }
  if (style?.flexWrap) {
    css.flexWrap = style.flexWrap;
  }
  if (style?.justifyContent) {
    css.justifyContent = style.justifyContent;
  }
  if (style?.alignItems) {
    css.alignItems = style.alignItems;
  }
  if (style?.alignContent) {
    css.alignContent = style.alignContent;
  }
  if (style?.rowGap != null) {
    css.rowGap = `${style.rowGap}px`;
  }
  if (style?.columnGap != null) {
    css.columnGap = `${style.columnGap}px`;
  }
  return css;
}

export function flexItemCss(style: FlexItemStyle | undefined): CSSProperties | undefined {
  if (!style) {
    return undefined;
  }

  const css: CSSProperties = {};
  if (style.order != null) {
    css.order = style.order;
  }
  if (style.flexGrow != null) {
    css.flexGrow = style.flexGrow;
  }
  if (style.flexShrink != null) {
    css.flexShrink = style.flexShrink;
  }
  if (style.flexBasis === 'auto') {
    css.flexBasis = 'auto';
  } else if (typeof style.flexBasis === 'number') {
    css.flexBasis = `${style.flexBasis}px`;
  }
  if (style.alignSelf) {
    css.alignSelf = style.alignSelf;
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
  if ((options?.animate ?? true) && style?.transition != null && style.transition > 0) {
    css.transition = `all ${style.transition}ms`;
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
      delete bound.width;
      delete bound.height;
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
  const size = widget.size != null && widget.size > 0 ? widget.size : 24;
  if (widget.style?.width && widget.style.height) {
    return widget.style;
  }
  return {
    ...widget.style,
    width: widget.style?.width ?? { mode: 'px', value: size },
    height: widget.style?.height ?? { mode: 'px', value: size },
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
    '.lowcode-table { scrollbar-width: none; }',
    '.lowcode-table::-webkit-scrollbar { width: 0; height: 0; display: none; }',
    '.lowcode-table-slot { display: flex; align-items: center; }',
    '.lowcode-dynamic-copy { cursor: help; }',
    '.lowcode-dynamic-copy-tip { position: fixed; z-index: 80; max-width: 360px; padding: 6px 8px; border-radius: 6px; background: rgba(21, 28, 34, 0.96); color: #fff; font: 12px/1.45 "Segoe UI", sans-serif; white-space: pre-wrap; word-break: break-all; pointer-events: none; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28); }',
    '.lowcode-table-slot > :where(.lowcode-icon, .lowcode-text, .lowcode-image, .lowcode-button) { vertical-align: middle; }',
  );
  return blocks.join('\n');
}
