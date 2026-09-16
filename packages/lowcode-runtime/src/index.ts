import { createElement, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parsePageXml, XmlParseError, type PageWidget, type WidgetStyle } from '@vanstack/xml';

const roots = new WeakMap<Element, Root>();

export type RenderPageXmlResult = { ok: true } | { ok: false; error: string };

function widgetCss(style: WidgetStyle | undefined): CSSProperties | undefined {
  if (!style) {
    return undefined;
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

  return Object.keys(css).length > 0 ? css : undefined;
}

function widgetElement(widget: PageWidget) {
  const style = widgetCss(widget.style);

  if (widget.type === 'text') {
    return createElement(
      'span',
      {
        key: widget.id,
        className: 'lowcode-text',
        'data-widget-id': widget.id,
        'data-widget-type': 'text',
        style,
      },
      widget.value,
    );
  }

  return createElement(
    'button',
    {
      key: widget.id,
      className: 'lowcode-button',
      type: 'button',
      'data-widget-id': widget.id,
      'data-widget-type': 'button',
      style,
    },
    widget.text,
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
