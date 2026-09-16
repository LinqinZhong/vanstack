import { createElement, type CSSProperties, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  parsePageXml,
  XmlParseError,
  type FlexContainerStyle,
  type FlexItemStyle,
  type PageWidget,
  type SizeValue,
  type WidgetStyle,
} from '@vanstack/xml';

const roots = new WeakMap<Element, Root>();

export type RenderPageXmlResult = { ok: true } | { ok: false; error: string };

function sizeCss(size: SizeValue | undefined): string {
  if (!size) {
    return 'fit-content';
  }
  return size.mode === '%' ? `${size.value}%` : `${size.value}px`;
}

function mergeCss(...parts: Array<CSSProperties | undefined>): CSSProperties | undefined {
  const css: CSSProperties = {};
  for (const part of parts) {
    if (part) {
      Object.assign(css, part);
    }
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

function widgetCss(style: WidgetStyle | undefined): CSSProperties | undefined {
  if (!style) {
    return { width: 'fit-content', height: 'fit-content' };
  }

  const css: CSSProperties = {};
  if (style.color) {
    css.color = style.color;
  }
  if (style.textShadow) {
    css.textShadow = style.textShadow;
  }
  if (style.italic) {
    css.fontStyle = 'italic';
  }
  if (style.fontWeight) {
    css.fontWeight = style.fontWeight;
  }

  const decorations: string[] = [];
  if (style.underline) {
    decorations.push('underline');
  }
  if (style.lineThrough) {
    decorations.push('line-through');
  }
  if (decorations.length > 0) {
    css.textDecoration = decorations.join(' ');
  }

  if (style.background) {
    css.background = style.background;
  }

  const hasBorder = style.borderWidth != null || style.borderStyle || style.borderColor;
  if (hasBorder) {
    css.borderWidth = style.borderWidth != null ? `${style.borderWidth}px` : '1px';
    css.borderStyle = style.borderStyle || 'solid';
    if (style.borderColor) {
      css.borderColor = style.borderColor;
    }
  } else if (style.background) {
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

  if (style.boxShadow) {
    css.boxShadow = style.boxShadow;
  }

  css.width = sizeCss(style.width);
  css.height = sizeCss(style.height);
  if (style.marginTop != null) {
    css.marginTop = `${style.marginTop}px`;
  }
  if (style.marginRight != null) {
    css.marginRight = `${style.marginRight}px`;
  }
  if (style.marginBottom != null) {
    css.marginBottom = `${style.marginBottom}px`;
  }
  if (style.marginLeft != null) {
    css.marginLeft = `${style.marginLeft}px`;
  }
  if (style.paddingTop != null) {
    css.paddingTop = `${style.paddingTop}px`;
  }
  if (style.paddingRight != null) {
    css.paddingRight = `${style.paddingRight}px`;
  }
  if (style.paddingBottom != null) {
    css.paddingBottom = `${style.paddingBottom}px`;
  }
  if (style.paddingLeft != null) {
    css.paddingLeft = `${style.paddingLeft}px`;
  }

  return Object.keys(css).length > 0 ? css : undefined;
}

function flexContainerCss(style: FlexContainerStyle | undefined): CSSProperties {
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

function flexItemCss(style: FlexItemStyle | undefined): CSSProperties | undefined {
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

function widgetElement(widget: PageWidget): ReactElement {
  const itemStyle = flexItemCss(widget.item);

  if (widget.type === 'text') {
    return createElement(
      'span',
      {
        key: widget.id,
        className: 'lowcode-text',
        'data-widget-id': widget.id,
        'data-widget-type': 'text',
        style: mergeCss(widgetCss(widget.style), itemStyle),
      },
      widget.value,
    );
  }

  if (widget.type === 'button') {
    return createElement(
      'button',
      {
        key: widget.id,
        className: 'lowcode-button',
        type: 'button',
        'data-widget-id': widget.id,
        'data-widget-type': 'button',
        style: mergeCss(widgetCss(widget.style), itemStyle),
      },
      widget.text,
    );
  }

  return createElement(
    'div',
    {
      key: widget.id,
      className: 'lowcode-flex',
      'data-widget-id': widget.id,
      'data-widget-type': 'flex',
      style: mergeCss(widgetCss(widget.style), flexContainerCss(widget.flex), itemStyle),
    },
    widget.children.map((child) => widgetElement(child)),
  );
}

function rootFor(container: HTMLElement): Root {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  return root;
}

export function renderPageXml(container: HTMLElement, xml: string): RenderPageXmlResult {
  const root = rootFor(container);

  try {
    const page = parsePageXml(xml);
    const tree = createElement(
      'div',
      { className: 'lowcode-page' },
      page.widgets.map((widget) => widgetElement(widget)),
    );
    root.render(tree);
    return { ok: true };
  } catch (error) {
    root.render(null);
    const message = error instanceof XmlParseError ? error.message : 'Invalid page XML';
    return { ok: false, error: message };
  }
}
