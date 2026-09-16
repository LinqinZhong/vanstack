import { useEffect, useRef, useState } from 'react';
import { renderPageXml } from '@vanstack/lowcode-runtime';
import { isLowcodeMessage, LOWCODE_MESSAGE_SOURCE } from './lowcode-protocol';

function applyViewport(host: HTMLElement, scale: number, width: number, height: number) {
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.zoom = String(scale);
  document.documentElement.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#fff';
}

function applyWidgetState(root: HTMLElement | null, selectedId: string | null) {
  if (!root) {
    return;
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-widget-id]')) {
    node.classList.toggle('is-widget-selected', node.dataset.widgetId === selectedId);
  }
}

function widgetIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const widget = target.closest('[data-widget-id]');
  return widget instanceof HTMLElement ? (widget.dataset.widgetId ?? null) : null;
}

function postToParent(payload: Record<string, unknown>) {
  window.parent.postMessage({ source: LOWCODE_MESSAGE_SOURCE, ...payload }, window.location.origin);
}

export function PreviewPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const xmlRef = useRef('');
  const editingRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isLowcodeMessage(event.data)) {
        return;
      }
      if (event.data.type !== 'preview' || !mountRef.current) {
        return;
      }
      const { xml, mode, selectedId, scale, screenWidth, screenHeight } = event.data;
      const nextEditing = mode !== 'preview';
      editingRef.current = nextEditing;
      setEditing(nextEditing);
      if (hostRef.current) {
        applyViewport(hostRef.current, scale, screenWidth, screenHeight);
      }
      if (xml !== xmlRef.current) {
        xmlRef.current = xml;
        const result = renderPageXml(mountRef.current, xml);
        setError(result.ok ? null : result.error);
      }
      applyWidgetState(mountRef.current, selectedId);
    }

    window.addEventListener('message', onMessage);
    postToParent({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) {
      return;
    }
    const root: HTMLDivElement = node;

    function onClick(event: MouseEvent) {
      if (!editingRef.current || event.button !== 0) {
        return;
      }
      event.preventDefault();
      postToParent({ type: 'select', widgetId: widgetIdFromTarget(event.target) });
    }

    function onWheel(event: WheelEvent) {
      if (!editingRef.current) {
        return;
      }
      event.preventDefault();
      postToParent({
        type: 'canvas-wheel',
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    }

    function onPointerDown(event: PointerEvent) {
      if (!editingRef.current || event.button !== 1) {
        return;
      }
      event.preventDefault();
      root.setPointerCapture(event.pointerId);
      postToParent({
        type: 'canvas-pointer',
        action: 'down',
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    function onPointerMove(event: PointerEvent) {
      if (!editingRef.current || !root.hasPointerCapture(event.pointerId)) {
        return;
      }
      postToParent({
        type: 'canvas-pointer',
        action: 'move',
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    function onPointerUp(event: PointerEvent) {
      if (!root.hasPointerCapture(event.pointerId)) {
        return;
      }
      root.releasePointerCapture(event.pointerId);
      postToParent({
        type: 'canvas-pointer',
        action: 'up',
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    function onAuxClick(event: MouseEvent) {
      if (editingRef.current && event.button === 1) {
        event.preventDefault();
      }
    }

    root.addEventListener('click', onClick);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('auxclick', onAuxClick);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerUp);
      root.removeEventListener('auxclick', onAuxClick);
    };
  }, []);

  return (
    <div ref={hostRef} className={editing ? 'preview-host is-editing' : 'preview-host'}>
      {error ? <p className="preview-error">{error}</p> : null}
      <div ref={mountRef} className="preview-mount" />
    </div>
  );
}
