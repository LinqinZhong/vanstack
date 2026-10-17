import type {
  AnimationDefinition,
  AnimationKeyframe,
  AnimationProps,
  WidgetAnimation,
} from '@vanstack/xml';

/**
 * 运行时动画目录：动画定义独立存储，控件只持 id。
 * 编辑器预览与发布页通过 installPageAnimations 下发动画目录。
 */
let catalog: Record<string, AnimationDefinition> = {};

export function installPageAnimations(
  next?: Readonly<Record<string, AnimationDefinition>> | ReadonlyArray<AnimationDefinition> | null,
): void {
  const map: Record<string, AnimationDefinition> = {};
  if (Array.isArray(next)) {
    for (const item of next) {
      if (item && item.id) {
        map[item.id] = item;
      }
    }
  } else if (next) {
    for (const item of Object.values(next)) {
      if (item && item.id) {
        map[item.id] = item;
      }
    }
  }
  catalog = map;
}

export function getPageAnimation(id: string): AnimationDefinition | undefined {
  return catalog[id];
}

const EASING_CSS: Record<string, string> = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  cubicIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  cubicOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  cubicInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
};

function easingToCss(easing: WidgetAnimation['easing']): string {
  return EASING_CSS[easing] ?? 'linear';
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 把关键帧属性合成为一个 transform 字符串。 */
export function animationTransformText(props: AnimationProps): string {
  const parts: string[] = [];
  const tx = normalizeNumber(props.translateX) ?? 0;
  const ty = normalizeNumber(props.translateY) ?? 0;
  if (tx || ty) {
    parts.push(`translate(${tx}px, ${ty}px)`);
  }
  const rx = normalizeNumber(props.rotateX);
  if (rx) parts.push(`rotateX(${rx}deg)`);
  const ry = normalizeNumber(props.rotateY);
  if (ry) parts.push(`rotateY(${ry}deg)`);
  const rz = normalizeNumber(props.rotateZ);
  if (rz) parts.push(`rotateZ(${rz}deg)`);
  const skew = normalizeNumber(props.screw);
  if (skew) parts.push(`skew(${skew}deg)`);
  const scale = normalizeNumber(props.scale);
  if (scale != null && scale !== 1) parts.push(`scale(${scale})`);
  return parts.join(' ');
}

function keyframeBody(props: AnimationProps): string {
  const body = [`transform: ${animationTransformText(props) || 'none'}`];
  const opacity = normalizeNumber(props.opacity);
  if (opacity != null) {
    body.push(`opacity: ${opacity}`);
  }
  return body.join('; ');
}

function clampOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(100, Math.max(0, Math.round(offset * 10) / 10));
}

function animationKeyframesText(name: string, keyframes: AnimationKeyframe[]): string {
  const frames = [...keyframes].sort((a, b) => clampOffset(a.offset) - clampOffset(b.offset));
  const body = frames.map((frame) => `${clampOffset(frame.offset)}% { ${keyframeBody(frame.props)} }`).join(' ');
  return `@keyframes ${name} { ${body} }`;
}

function animationRuleText(selector: string, name: string, binding: WidgetAnimation): string {
  // 时长单位为「秒」（与编辑器一致），保留小数，不做取整；非法或非正数回退 0.3s。
  const duration = Number.isFinite(binding.duration) && binding.duration > 0 ? binding.duration : 0.3;
  const mode = binding.mode;
  const iteration = mode === 'repeat' || mode === 'alternate' ? 'infinite' : '1';
  const direction = mode === 'alternate' ? 'alternate' : 'normal';
  // once / repeat / alternate 播完回到原始状态；hold 停在末帧。
  const fill = mode === 'hold' ? 'forwards' : 'none';
  return [
    `${selector} {`,
    ` animation-name: ${name};`,
    ` animation-duration: ${duration}s;`,
    ` animation-timing-function: ${easingToCss(binding.easing)};`,
    ` animation-iteration-count: ${iteration};`,
    ` animation-direction: ${direction};`,
    ` animation-fill-mode: ${fill};`,
    ' }',
  ].join('');
}

function sanitizeName(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '-');
  return safe || 'x';
}

/**
 * 关键帧名带上动画定义 id，避免同一控件在不同状态下绑定不同动画时
 * 复用同一个 @keyframes 名导致互相覆盖。目录缺该动画时返回 null。
 */
export function animationKeyframesFor(
  widgetId: string,
  binding: WidgetAnimation | undefined,
): { name: string; css: string } | null {
  if (!binding || !binding.id) {
    return null;
  }
  const def = catalog[binding.id];
  if (!def || !Array.isArray(def.keyframes) || def.keyframes.length === 0) {
    return null;
  }
  const name = `lw-anim-${sanitizeName(widgetId)}-${sanitizeName(binding.id)}`;
  return { name, css: animationKeyframesText(name, def.keyframes) };
}

/** 为指定选择器生成 animation 规则（调用方负责同时发射对应的 @keyframes）。 */
export function animationRuleFor(
  selector: string,
  widgetId: string,
  binding: WidgetAnimation | undefined,
): string | null {
  const kf = animationKeyframesFor(widgetId, binding);
  if (!kf || !binding) {
    return null;
  }
  return animationRuleText(selector, kf.name, binding);
}

