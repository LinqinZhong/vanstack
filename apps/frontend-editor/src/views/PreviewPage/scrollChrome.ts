import { LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { previewVisualScale } from '../../utils/spacingGuides';
import { postToParent, resolveWidgetNode } from './helpers';

export type ScrollChromeLabels = {
  editScroll: string;
  exitScroll: string;
};

type Box = { left: number; top: number; width: number; height: number };

const MODE_ATTR = 'data-scroll-mode';
const OPEN_EDITOR = '.is-scroll-open, .is-table-open, .is-swiper-open';

/** 当前真正在编辑的那一层。外层为了不裁切内容也会带着 open，这里把它们排除。 */
export function leafOpenEditor(root: HTMLElement | null): HTMLElement | null {
  if (!root) {
    return null;
  }
  const nodes = [...root.querySelectorAll<HTMLElement>(OPEN_EDITOR)];
  const leaves = nodes.filter((node) => !nodes.some((other) => other !== node && node.contains(other)));
  const selected = root.querySelector('.is-widget-selected');
  if (selected instanceof HTMLElement) {
    const hit = leaves.find((node) => node === selected || node.contains(selected));
    if (hit) {
      return hit;
    }
  }
  return leaves[0] ?? null;
}

/** host 局部坐标到客户端坐标的实际缩放（含 zoom/相机变换），异常时回退旧算法。 */
function hostClientScale(host: HTMLElement, fallback: number): number {
  const hostRect = host.getBoundingClientRect();
  const scale = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 0;
  return Number.isFinite(scale) && scale > 0 ? scale : previewVisualScale(host, fallback);
}

function hostBox(host: HTMLElement, node: HTMLElement, zoom: number): Box {
  const hostRect = host.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const fallback = previewVisualScale(host, zoom);
  const scale = hostClientScale(host, fallback);
  // 组件编辑态主体被 position:fixed 抽出，缩放链可能与 host 不同，
  // 因此用各自矩形/布局尺寸比反推，并把节点尺寸换算到 host 局部坐标。
  const nodeScale =
    node.offsetWidth > 0 && rect.width > 0 ? rect.width / node.offsetWidth : scale;
  const width = (node.offsetWidth * nodeScale) / scale;
  const height = (node.offsetHeight * nodeScale) / scale;
  const centerX = (rect.left + rect.width / 2 - hostRect.left) / scale;
  const centerY = (rect.top + rect.height / 2 - hostRect.top) / scale;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

function clampButtonInView(button: HTMLElement, host: HTMLElement, zoom: number) {
  const scale = Math.max(hostClientScale(host, previewVisualScale(host, zoom)), 0.01);
  const rect = button.getBoundingClientRect();
  const view = button.ownerDocument.documentElement;
  const inset = 2;
  let shiftX = 0;
  let shiftY = 0;
  if (rect.top < inset) {
    shiftY = inset - rect.top;
  }
  if (rect.bottom + shiftY > view.clientHeight - inset) {
    shiftY = view.clientHeight - inset - rect.bottom;
  }
  if (rect.left < inset) {
    shiftX = inset - rect.left;
  }
  if (rect.right + shiftX > view.clientWidth - inset) {
    shiftX = view.clientWidth - inset - rect.right;
  }
  if (shiftX === 0 && shiftY === 0) {
    return;
  }
  const left = Number.parseFloat(button.style.left) || 0;
  const top = Number.parseFloat(button.style.top) || 0;
  button.style.left = `${left + shiftX / scale}px`;
  button.style.top = `${top + shiftY / scale}px`;
}

function openScroll(scroll: HTMLElement) {
  scroll.classList.add('is-scroll-open');
  const view = scroll.querySelector<HTMLElement>(':scope > .lowcode-scroll-port > .lowcode-scroll-view');
  if (!view) {
    return;
  }
  view.scrollTop = 0;
  view.scrollLeft = 0;
}

/** 定位正在编辑的滚动容器：优先按父页下发的编辑 id；无 id 时退化为按选中项推断（嵌套时不可靠，仅兜底）。 */
function editingScroll(root: HTMLElement, editingId: string | null): HTMLElement | null {
  if (editingId) {
    const node = resolveWidgetNode(root, editingId);
    if (node instanceof HTMLElement && node.classList.contains('lowcode-scroll')) {
      return node;
    }
  }
  const selected = root.querySelector('.is-widget-selected');
  if (!(selected instanceof HTMLElement)) {
    return null;
  }
  if (selected.dataset.widgetType === 'scroll') {
    return selected;
  }
  const scroll = selected.closest('.lowcode-scroll');
  return scroll instanceof HTMLElement ? scroll : null;
}

/** 进入滚动容器编辑后露出内部内容，并藏起页面上的其它控件。表格编辑时只把外层容器打开，避免内容被裁掉。 */
export function syncScrollReveal(
  host: HTMLElement | null,
  root: HTMLElement | null,
  editing: boolean,
  scrollEditing: boolean,
  scrollEditingId: string | null = null,
) {
  const clearOpen = (keep?: ReadonlySet<HTMLElement>) => {
    root?.querySelectorAll('.lowcode-scroll.is-scroll-open').forEach((node) => {
      if (keep?.has(node as HTMLElement)) {
        return;
      }
      node.classList.remove('is-scroll-open');
    });
  };
  if (!host || !root || !editing) {
    host?.classList.remove('is-scroll-editing');
    clearOpen();
    return;
  }
  const keep = new Set<HTMLElement>();
  const scroll = scrollEditing ? editingScroll(root, scrollEditingId) : null;
  if (scroll) {
    openScroll(scroll);
    keep.add(scroll);
    // 嵌套滚动容器：编辑内层时外层也要保持打开，否则内层随外层一起被裁切/隐藏。
    let ancestor = scroll.parentElement;
    while (ancestor) {
      if (ancestor instanceof HTMLElement && ancestor.classList.contains('lowcode-scroll')) {
        openScroll(ancestor);
        keep.add(ancestor);
      }
      ancestor = ancestor.parentElement;
    }
  }
  const table = root.querySelector('.lowcode-table.is-table-open');
  let parent = table?.parentElement ?? null;
  while (parent) {
    if (parent.classList.contains('lowcode-scroll') && parent instanceof HTMLElement) {
      openScroll(parent);
      keep.add(parent);
    }
    parent = parent.parentElement;
  }
  /* 先标好要留的滚动层，再切编辑态，避免窗口在 :not(:has(.is-scroll-open)) 下被整页收起。 */
  if (scroll) {
    clearOpen(keep);
    host.classList.add('is-scroll-editing');
  } else {
    host.classList.remove('is-scroll-editing');
    clearOpen(keep);
  }
}

const PEN_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

/**
 * paintEditMask：在控件上方画灰色遮罩 + 居中笔图标。
 * 单击：未选中则选中控件，已选中则进入对应编辑态（table/scroll/swiper）。
 * 遮罩带 data-edit-mask-for，供 canvasHit 把指针事件解析回原控件。
 */
export function paintEditMask(
  host: HTMLElement | null,
  widget: HTMLElement | null,
  box: Box,
  modeType: 'table' | 'scroll' | 'swiper',
) {
  const selector = `[data-edit-mask="${modeType}"]`;
  const remove = () => host?.querySelector(selector)?.remove();
  if (!host || !widget) {
    remove();
    return;
  }
  const widgetId = widget.dataset.widgetId;
  if (!widgetId) {
    remove();
    return;
  }
  let mask = host.querySelector<HTMLDivElement>(selector);
  if (!mask) {
    mask = document.createElement('div');
    mask.className = 'edit-mask';
    mask.setAttribute('data-edit-mask', modeType);
    const pen = document.createElement('span');
    pen.className = 'edit-mask-pen';
    pen.setAttribute('aria-hidden', 'true');
    pen.innerHTML = PEN_SVG;
    mask.append(pen);
    host.append(mask);
  }
  mask.dataset.editMaskFor = widgetId;
  mask.dataset.widgetType = widget.dataset.widgetType ?? modeType;
  mask.style.left = `${box.left}px`;
  mask.style.top = `${box.top}px`;
  mask.style.width = `${box.width}px`;
  mask.style.height = `${box.height}px`;
  // 单击：已选中则进入编辑，否则选中。阻止冒泡避免父级 onclick 把同控件的再次点击当成上钻。
  mask.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (widget.classList.contains('is-widget-selected')) {
      postToParent({ type: `${modeType}-mode`, action: 'enter' });
    } else {
      postToParent({ type: 'select', widgetId });
    }
  };
  mask.ondblclick = null;
}

/** 滚动容器：未进入时在控件上画灰色遮罩 + 笔图标（单击选中，再点进入），编辑中显示「退出编辑」。 */
export function paintScrollModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  scrollEditing: boolean,
  labels: ScrollChromeLabels,
  hoverWidget: HTMLElement | null = null,
  hasSpacingDrag = false,
  scrollEditingId: string | null = null,
) {
  const removeButton = () => host?.querySelector(`[${MODE_ATTR}]`)?.remove();
  const removeMask = () => host?.querySelector('[data-edit-mask="scroll"]')?.remove();
  if (!host || !root || !editing) {
    removeButton();
    removeMask();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const open = scrollEditing ? editingScroll(root, scrollEditingId) : null;
  // 遮罩只在「已选中且悬停」时出现；嵌套场景下可能是正在编辑层里面的内层容器。
  const targetScroll = selected === hoverWidget && selected?.dataset.widgetType === 'scroll' ? selected : null;
  if (open) {
    if (leafOpenEditor(root) !== open) {
      removeButton();
      removeMask();
      return;
    }
    let button = host.querySelector<HTMLButtonElement>(`[${MODE_ATTR}]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-mode-button';
      button.setAttribute(MODE_ATTR, '');
      host.append(button);
    }
    button.dataset.scrollMode = 'exit';
    button.classList.add('is-exit');
    button.textContent = labels.exitScroll || '退出编辑';
    button.title = 'Esc';
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'scroll-mode', action: 'exit' },
        window.location.origin,
      );
    };
    const box = hostBox(host, open, zoom);
    button.style.left = `${box.left + box.width}px`;
    button.style.top = `${box.top - 4}px`;
    button.style.transform = 'translate(-100%, -100%)';
    clampButtonInView(button, host, zoom);
    // 嵌套滚动容器：编辑外层时，悬停内层滚动容器仍画遮罩（单击选中，再点进入内层编辑）。
    if (!hasSpacingDrag && targetScroll && targetScroll !== open && open.contains(targetScroll)) {
      paintEditMask(host, targetScroll, hostBox(host, targetScroll, zoom), 'scroll');
    } else {
      removeMask();
    }
    return;
  }
  removeButton();
  // 间距/尺寸拖拽态：不画遮罩，避免盖住间距手柄。
  if (hasSpacingDrag) {
    removeMask();
    return;
  }
  if (!targetScroll) {
    removeMask();
    return;
  }
  paintEditMask(host, targetScroll, hostBox(host, targetScroll, zoom), 'scroll');
}

const SWIPER_MODE_ATTR = 'data-swiper-mode';

export type SwiperChromeLabels = {
  editSwiper: string;
  exitSwiper: string;
};

function editingSwiper(root: HTMLElement): HTMLElement | null {
  const selected = root.querySelector('.is-widget-selected');
  if (!(selected instanceof HTMLElement)) {
    return null;
  }
  if (selected.dataset.widgetType === 'swiper') {
    return selected;
  }
  const swiper = selected.closest('.lowcode-swiper');
  return swiper instanceof HTMLElement ? swiper : null;
}

function openAncestorScrolls(node: Element | null) {
  let parent = node?.parentElement ?? null;
  while (parent) {
    if (parent.classList.contains('lowcode-scroll') && parent instanceof HTMLElement) {
      openScroll(parent);
    }
    parent = parent.parentElement;
  }
}

/** 进入滑动器编辑后露出全部分页，并藏起页面上的其它控件。 */
export function syncSwiperReveal(
  host: HTMLElement | null,
  root: HTMLElement | null,
  editing: boolean,
  swiperEditing: boolean,
) {
  const clearOpen = () => {
    root?.querySelectorAll('.lowcode-swiper.is-swiper-open').forEach((node) => {
      node.classList.remove('is-swiper-open');
    });
  };
  if (!host || !root || !editing) {
    host?.classList.remove('is-swiper-editing');
    clearOpen();
    return;
  }
  clearOpen();
  const swiper = swiperEditing ? editingSwiper(root) : null;
  if (swiper) {
    host.classList.add('is-swiper-editing');
    swiper.classList.add('is-swiper-open');
    openAncestorScrolls(swiper);
  } else {
    host.classList.remove('is-swiper-editing');
  }
}

/** 滑动器：未进入时在控件上画灰色遮罩 + 笔图标（单击选中，再点进入），编辑中显示「退出编辑」。 */
export function paintSwiperModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  swiperEditing: boolean,
  labels: SwiperChromeLabels,
  hoverWidget: HTMLElement | null = null,
  hasSpacingDrag = false,
) {
  const removeButton = () => host?.querySelector(`[${SWIPER_MODE_ATTR}]`)?.remove();
  const removeMask = () => host?.querySelector('[data-edit-mask="swiper"]')?.remove();
  if (!host || !root || !editing) {
    removeButton();
    removeMask();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const open = swiperEditing ? editingSwiper(root) : null;
  if (open) {
    removeMask();
    if (leafOpenEditor(root) !== open) {
      removeButton();
      return;
    }
    let button = host.querySelector<HTMLButtonElement>(`[${SWIPER_MODE_ATTR}]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-mode-button';
      button.setAttribute(SWIPER_MODE_ATTR, '');
      host.append(button);
    }
    button.dataset.swiperMode = 'exit';
    button.classList.add('is-exit');
    button.textContent = labels.exitSwiper || '退出编辑';
    button.title = 'Esc';
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'swiper-mode', action: 'exit' },
        window.location.origin,
      );
    };
    const box = hostBox(host, open, zoom);
    button.style.left = `${box.left + box.width}px`;
    button.style.top = `${box.top - 4}px`;
    button.style.transform = 'translate(-100%, -100%)';
    clampButtonInView(button, host, zoom);
    return;
  }
  removeButton();
  // 间距/尺寸拖拽态：不画遮罩，避免盖住间距手柄。
  if (hasSpacingDrag) {
    removeMask();
    return;
  }
  // 遮罩只在「已选中且悬停」时出现。
  const swiper = selected === hoverWidget && selected?.dataset.widgetType === 'swiper' ? selected : null;
  if (!swiper) {
    removeMask();
    return;
  }
  const box = hostBox(host, swiper, zoom);
  paintEditMask(host, swiper, box, 'swiper');
}

/**
 * 插槽使用编辑：只露出被编辑插槽的内容。
 * host 加 .is-component-editing（CSS 据此藏掉页面壳与所有 [data-widget-id]），
 * 目标插槽元素加 .is-slot-focus（CSS 据此让该插槽及其内部内容可见、并放开祖先裁切）。
 * 隔离完全由 CSS 完成，控件仍在真实布局位置，不改运行时渲染。
 */
export function syncComponentSlotFocus(
  host: HTMLElement | null,
  root: HTMLElement | null,
  editing: boolean,
  componentEditing: boolean,
  slotFocusId: string | null,
) {
  const clear = () => {
    host?.classList.remove('is-component-editing');
    root?.querySelectorAll('.lowcode-slot.is-slot-focus').forEach((node) => {
      node.classList.remove('is-slot-focus');
    });
  };
  if (!host || !root || !editing || !componentEditing || !slotFocusId) {
    clear();
    return;
  }
  const slot = resolveWidgetNode(root, slotFocusId);
  if (!(slot instanceof HTMLElement) || !slot.classList.contains('lowcode-slot')) {
    clear();
    return;
  }
  host.classList.add('is-component-editing');
  root.querySelectorAll<HTMLElement>('.lowcode-slot.is-slot-focus').forEach((node) => {
    if (node !== slot) {
      node.classList.remove('is-slot-focus');
    }
  });
  slot.classList.add('is-slot-focus');
}
