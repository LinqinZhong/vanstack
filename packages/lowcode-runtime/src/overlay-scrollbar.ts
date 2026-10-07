const THUMB_INSET = 2;
const THUMB_HIDE_MS = 700;

function placeThumb(thumb: HTMLElement, size: number, offset: number, axis: 'x' | 'y') {
  if (axis === 'y') {
    thumb.style.height = `${size}px`;
    thumb.style.transform = `translateY(${offset}px)`;
    return;
  }
  thumb.style.width = `${size}px`;
  thumb.style.transform = `translateX(${offset}px)`;
}

function thumbMetrics(client: number, scroll: number, pos: number, cross: boolean) {
  const track = Math.max(0, client - THUMB_INSET * 2 - (cross ? 8 : 0));
  if (scroll <= client + 1 || track <= 0) {
    return null;
  }
  const size = Math.max(16, Math.min(track, (client / scroll) * track));
  const range = scroll - client;
  const offset = range > 0 ? (pos / range) * (track - size) : 0;
  return { size, offset };
}

function paintThumb(thumb: HTMLElement, metrics: { size: number; offset: number } | null, axis: 'x' | 'y', active: boolean) {
  thumb.style.transition = active ? 'opacity 80ms ease' : 'opacity 450ms ease';
  thumb.style.opacity = active && metrics ? '1' : '0';
  if (metrics) {
    placeThumb(thumb, metrics.size, metrics.offset, axis);
  }
}

function syncScrollThumbs(view: HTMLElement, yThumb: HTMLElement, xThumb: HTMLElement, active: boolean) {
  const y = thumbMetrics(view.clientHeight, view.scrollHeight, view.scrollTop, view.scrollWidth > view.clientWidth + 1);
  const x = thumbMetrics(view.clientWidth, view.scrollWidth, view.scrollLeft, view.scrollHeight > view.clientHeight + 1);
  paintThumb(yThumb, y, 'y', active);
  paintThumb(xThumb, x, 'x', active);
}

/** 藏起原生滚动条后，用叠在内容上的滑块代替。只在滚动过程中显示。 */
export function bindOverlayScrollbar(view: HTMLElement, yThumb: HTMLElement, xThumb: HTMLElement) {
  let hideTimer = 0;
  const show = () => {
    syncScrollThumbs(view, yThumb, xThumb, true);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => syncScrollThumbs(view, yThumb, xThumb, false), THUMB_HIDE_MS);
  };
  view.addEventListener('scroll', show, { passive: true });
  return () => {
    view.removeEventListener('scroll', show);
    window.clearTimeout(hideTimer);
  };
}
