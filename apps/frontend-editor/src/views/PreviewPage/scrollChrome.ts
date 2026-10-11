import { LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { previewVisualScale } from '../../utils/spacingGuides';
import { resolveWidgetNode } from './helpers';

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

function editingScroll(root: HTMLElement): HTMLElement | null {
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
  const scroll = scrollEditing ? editingScroll(root) : null;
  if (scroll) {
    openScroll(scroll);
    keep.add(scroll);
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

/** 滚动容器上方：未进入时显示「编辑滚动容器」，编辑中显示「退出编辑」。 */
export function paintScrollModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  scrollEditing: boolean,
  labels: ScrollChromeLabels,
) {
  const remove = () => host?.querySelector(`[${MODE_ATTR}]`)?.remove();
  if (!host || !root || !editing) {
    remove();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const open = scrollEditing ? editingScroll(root) : null;
  const scroll = open ?? (selected?.dataset.widgetType === 'scroll' ? selected : null);
  if (!scroll || (open && leafOpenEditor(root) !== scroll)) {
    remove();
    return;
  }
  const mode = open ? 'exit' : 'enter';
  let button = host.querySelector<HTMLButtonElement>(`[${MODE_ATTR}]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-mode-button';
    button.setAttribute(MODE_ATTR, '');
    host.append(button);
  }
  button.dataset.scrollMode = mode;
  button.classList.toggle('is-exit', mode === 'exit');
  button.textContent = mode === 'exit' ? labels.exitScroll || '退出编辑' : labels.editScroll || '编辑滚动容器';
  button.title = mode === 'exit' ? 'Esc' : 'Enter';
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage(
      { source: LOWCODE_MESSAGE_SOURCE, type: 'scroll-mode', action: mode },
      window.location.origin,
    );
  };
  const box = hostBox(host, scroll, zoom);
  button.style.left = `${box.left + box.width}px`;
  button.style.top = `${box.top - 4}px`;
  button.style.transform = 'translate(-100%, -100%)';
  clampButtonInView(button, host, zoom);
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

/** 滑动器右上角：未进入时显示「编辑滑动器」，编辑中显示「退出编辑」。 */
export function paintSwiperModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  swiperEditing: boolean,
  labels: SwiperChromeLabels,
) {
  const remove = () => host?.querySelector(`[${SWIPER_MODE_ATTR}]`)?.remove();
  if (!host || !root || !editing) {
    remove();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const open = swiperEditing ? editingSwiper(root) : null;
  const swiper = open ?? (selected?.dataset.widgetType === 'swiper' ? selected : null);
  if (!swiper || (open && leafOpenEditor(root) !== swiper)) {
    remove();
    return;
  }
  const mode = open ? 'exit' : 'enter';
  let button = host.querySelector<HTMLButtonElement>(`[${SWIPER_MODE_ATTR}]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-mode-button';
    button.setAttribute(SWIPER_MODE_ATTR, '');
    host.append(button);
  }
  button.dataset.swiperMode = mode;
  button.classList.toggle('is-exit', mode === 'exit');
  button.textContent = mode === 'exit' ? labels.exitSwiper || '退出编辑' : labels.editSwiper || '编辑滑动器';
  button.title = mode === 'exit' ? 'Esc' : 'Enter';
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage(
      { source: LOWCODE_MESSAGE_SOURCE, type: 'swiper-mode', action: mode },
      window.location.origin,
    );
  };
  const box = hostBox(host, swiper, zoom);
  button.style.left = `${box.left + box.width}px`;
  button.style.top = `${box.top - 4}px`;
  button.style.transform = 'translate(-100%, -100%)';
  clampButtonInView(button, host, zoom);
}

const COMPONENT_MODE_ATTR = 'data-component-mode';

export type ComponentChromeLabels = {
  editComponent: string;
  exitComponent: string;
};

/**
 * 组件编辑态下真正作为编辑主体的那个组件。
 * 选中节点可能是插槽内容里的嵌套组件，因此要沿组件外壳上溯到最外层——
 * 组件编辑态保持期间，选中节点必定落在被编辑组件内部。
 */
/**
 * 定位当前正在编辑的组件主体：
 * 优先取已标记的 .is-component-host；其次从当前选中项上钻；
 * 最后按编辑根 id 兜底（组件编辑态下可能没有任何选中项）。
 */
export function editingComponentHost(
  root: HTMLElement,
  componentEditId: string | null,
): HTMLElement | null {
  const marked = root.querySelector<HTMLElement>('.lowcode-component.is-component-host');
  if (marked) {
    return marked;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  if (selected) {
    let host: HTMLElement | null =
      selected.dataset.widgetType === 'component'
        ? selected
        : selected.closest<HTMLElement>('.lowcode-component');
    while (host) {
      const outer = host.parentElement?.closest<HTMLElement>('.lowcode-component');
      if (!outer) {
        break;
      }
      host = outer;
    }
    return host;
  }
  if (componentEditId) {
    const byId = resolveWidgetNode(root, componentEditId);
    if (byId instanceof HTMLElement && byId.classList.contains('lowcode-component')) {
      return byId;
    }
  }
  return null;
}

/**
 * 进入组件编辑后藏起页面上的其它控件，并给编辑主体组件打上 is-component-host：
 * CSS 据此把组件脱到屏幕中间，只露出它的内部内容（含插槽）。
 */
export function syncComponentReveal(
  host: HTMLElement | null,
  root: HTMLElement | null,
  editing: boolean,
  componentEditing: boolean,
  componentEditId: string | null,
) {
  if (!host || !root || !editing) {
    host?.classList.remove('is-component-editing');
    root?.querySelectorAll('.lowcode-component.is-component-host').forEach((node) => {
      node.classList.remove('is-component-host');
    });
    return;
  }
  if (componentEditing) {
    host.classList.add('is-component-editing');
    const componentHost = editingComponentHost(root, componentEditId);
    root.querySelectorAll<HTMLElement>('.lowcode-component.is-component-host').forEach((node) => {
      if (node !== componentHost) {
        node.classList.remove('is-component-host');
      }
    });
    componentHost?.classList.add('is-component-host');
  } else {
    host.classList.remove('is-component-editing');
    root.querySelectorAll('.lowcode-component.is-component-host').forEach((node) => {
      node.classList.remove('is-component-host');
    });
  }
}

/** 组件右上角：未进入时显示「编辑组件」，编辑中显示「退出编辑」。 */
export function paintComponentModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  componentEditing: boolean,
  labels: ComponentChromeLabels,
  componentEditId: string | null,
) {
  const remove = () => host?.querySelector(`[${COMPONENT_MODE_ATTR}]`)?.remove();
  if (!host || !root || !editing) {
    remove();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const isComponent = selected?.dataset.widgetType === 'component';
  if (componentEditing) {
    // 编辑中（即使选中了插槽/插槽内容/嵌套组件，或没有任何选中项）：
    // 退出按钮始终跟随最外层编辑主体
    const hostWidget = editingComponentHost(root, componentEditId);
    if (!hostWidget) {
      remove();
      return;
    }
    let button = host.querySelector<HTMLButtonElement>(`[${COMPONENT_MODE_ATTR}]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-mode-button';
      button.setAttribute(COMPONENT_MODE_ATTR, '');
      host.append(button);
    }
    button.dataset.componentMode = 'exit';
    button.classList.add('is-exit');
    button.textContent = labels.exitComponent || '退出编辑';
    button.title = 'Esc';
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'component-mode', action: 'exit' },
        window.location.origin,
      );
    };
    const box = hostBox(host, hostWidget, zoom);
    // 与「编辑组件」按钮及 scroll/swiper/table 模式按钮一致：固定在右上角，避免切换时跳位。
    button.style.left = `${box.left + box.width}px`;
    button.style.top = `${box.top - 4}px`;
    button.style.transform = 'translate(-100%, -100%)';
    clampButtonInView(button, host, zoom);
    return;
  }
  if (!isComponent || !selected) {
    remove();
    return;
  }
  // 未进入：在组件右上角显示「编辑组件」
  let button = host.querySelector<HTMLButtonElement>(`[${COMPONENT_MODE_ATTR}]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-mode-button';
    button.setAttribute(COMPONENT_MODE_ATTR, '');
    host.append(button);
  }
  button.dataset.componentMode = 'enter';
  button.classList.remove('is-exit');
  button.textContent = labels.editComponent || '编辑组件';
  button.title = 'Enter';
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage(
      { source: LOWCODE_MESSAGE_SOURCE, type: 'component-mode', action: 'enter' },
      window.location.origin,
    );
  };
  const box = hostBox(host, selected!, zoom);
  button.style.left = `${box.left + box.width}px`;
  button.style.top = `${box.top - 4}px`;
  button.style.transform = 'translate(-100%, -100%)';
  clampButtonInView(button, host, zoom);
}
