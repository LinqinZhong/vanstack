import { LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { previewVisualScale } from '../../utils/spacingGuides';

export type ScrollChromeLabels = {
  editScroll: string;
  exitScroll: string;
};

type Box = { left: number; top: number; width: number; height: number };

const MODE_ATTR = 'data-scroll-mode';

function hostBox(host: HTMLElement, node: HTMLElement, zoom: number): Box {
  const hostRect = host.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
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
  const scale = Math.max(previewVisualScale(host, zoom), 0.01);
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
  const clearOpen = () => {
    root?.querySelectorAll('.lowcode-scroll.is-scroll-open').forEach((node) => {
      node.classList.remove('is-scroll-open');
    });
  };
  if (!host || !root || !editing) {
    host?.classList.remove('is-scroll-editing');
    clearOpen();
    return;
  }
  root.querySelectorAll<HTMLElement>('.lowcode-scroll').forEach((node) => {
    if (node.scrollTop !== 0) {
      node.scrollTop = 0;
    }
    if (node.scrollLeft !== 0) {
      node.scrollLeft = 0;
    }
  });
  clearOpen();
  const scroll = scrollEditing ? editingScroll(root) : null;
  if (scroll) {
    host.classList.add('is-scroll-editing');
    scroll.classList.add('is-scroll-open');
  } else {
    host.classList.remove('is-scroll-editing');
  }
  const table = root.querySelector('.lowcode-table.is-table-open');
  let parent = table?.parentElement ?? null;
  while (parent) {
    if (parent.classList.contains('lowcode-scroll')) {
      parent.classList.add('is-scroll-open');
    }
    parent = parent.parentElement;
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
  if (!scroll) {
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
    if (parent.classList.contains('lowcode-scroll')) {
      parent.classList.add('is-scroll-open');
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
  if (!swiper) {
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
