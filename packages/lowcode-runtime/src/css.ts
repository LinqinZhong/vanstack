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
  type SizeValue,
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
  if (style.italic) {
    css.fontStyle = 'italic';
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

  const background = cssText(style.background, options);
  if (background) {
    css.background = background;
  }

  const borderColor = cssText(style.borderColor, options);
  const borderStyle = cssText(style.borderStyle, options);
  const hasBorderWidth =
    style.borderTopWidth != null ||
    style.borderRightWidth != null ||
    style.borderBottomWidth != null ||
    style.borderLeftWidth != null;
  const hasBorder = hasBorderWidth || borderStyle || borderColor;
  if (hasBorder) {
    const unsetWidth = hasBorderWidth ? 0 : 1;
    css.borderTopWidth = `${style.borderTopWidth ?? unsetWidth}px`;
    css.borderRightWidth = `${style.borderRightWidth ?? unsetWidth}px`;
    css.borderBottomWidth = `${style.borderBottomWidth ?? unsetWidth}px`;
    css.borderLeftWidth = `${style.borderLeftWidth ?? unsetWidth}px`;
    css.borderStyle = borderStyle || 'solid';
    if (borderColor) {
      css.borderColor = borderColor;
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
