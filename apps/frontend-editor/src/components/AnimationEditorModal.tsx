import { CaretRightOutlined, DeleteOutlined, PauseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Modal, Select } from 'antd';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AnimationDefinitionDto,
  AnimationKeyframe,
  AnimationProps,
  UpdateAnimationInput,
} from '@vanstack/shared';

export type AnimationEditorModalProps = {
  open: boolean;
  animation: AnimationDefinitionDto | null;
  onCancel: () => void;
  onSave: (input: UpdateAnimationInput) => Promise<void> | void;
};

type PropKey = keyof AnimationProps;
type PropValues = Record<PropKey, number>;

const IDENTITY: PropValues = {
  translateX: 0,
  translateY: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  screw: 0,
  opacity: 1,
  scale: 1,
};

const PROP_FIELDS: Array<{ key: PropKey; label: string; step: number; min?: number; max?: number }> = [
  { key: 'translateX', label: 'translateX', step: 1 },
  { key: 'translateY', label: 'translateY', step: 1 },
  { key: 'rotateX', label: 'rotateX', step: 1 },
  { key: 'rotateY', label: 'rotateY', step: 1 },
  { key: 'rotateZ', label: 'rotateZ', step: 1 },
  { key: 'screw', label: 'screw', step: 1 },
  { key: 'opacity', label: 'opacity', step: 0.1, min: 0, max: 1 },
  { key: 'scale', label: 'scale', step: 0.1 },
];

const PLAY_DURATION = 2000;

const styles: Record<string, CSSProperties> = {
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  split: { display: 'flex', gap: 12, height: 360 },
  canvas: {
    position: 'relative',
    flex: '0 0 50%',
    overflow: 'hidden',
    background: '#f5f7fa',
    border: '1px solid #e8e8e8',
    borderRadius: 8,
    cursor: 'grab',
    userSelect: 'none',
  },
  canvasLayer: { position: 'absolute', left: '50%', top: '50%', transformOrigin: '0 0' },
  triangleWrap: { position: 'absolute', left: -60, top: -60, width: 120, height: 120, transformOrigin: 'center' },
  canvasToolbar: { position: 'absolute', left: 8, top: 8, display: 'flex', gap: 6 },
  canvasCoord: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    background: 'rgba(255,255,255,0.8)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  fields: {
    flex: '0 0 50%',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    alignContent: 'start',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 2 },
  fieldLabel: { fontSize: 12, color: 'rgba(0,0,0,0.65)' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f0f0f0', paddingTop: 12 },
  timelineControls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  percent: { fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'right' },
  track: { position: 'relative', height: 28, background: '#f0f0f0', borderRadius: 6, cursor: 'pointer', userSelect: 'none' },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'rgba(22,119,255,0.15)',
    borderRadius: 6,
    pointerEvents: 'none',
  },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, background: '#1677ff', pointerEvents: 'none' },
  marker: {
    position: 'absolute',
    top: '50%',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    background: '#8c8c8c',
    border: '1px solid #fff',
    transform: 'rotate(45deg)',
    cursor: 'ew-resize',
  },
  markerActive: { background: '#1677ff' },
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function sortKeyframes(frames: AnimationKeyframe[]): AnimationKeyframe[] {
  return [...frames].sort((a, b) => a.offset - b.offset);
}

function sampleProps(frames: AnimationKeyframe[], percent: number): PropValues {
  const out: PropValues = { ...IDENTITY };
  if (frames.length === 0) {
    return out;
  }
  const sorted = sortKeyframes(frames);
  const last = sorted[sorted.length - 1];
  let from = sorted[0];
  let to = sorted[0];
  let t = 0;
  if (percent <= sorted[0].offset) {
    from = sorted[0];
    to = sorted[0];
  } else if (percent >= last.offset) {
    from = last;
    to = last;
  } else {
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (percent >= a.offset && percent <= b.offset) {
        from = a;
        to = b;
        const span = b.offset - a.offset;
        t = span > 0 ? (percent - a.offset) / span : 0;
        break;
      }
    }
  }
  for (const field of PROP_FIELDS) {
    const av = from.props[field.key] ?? IDENTITY[field.key];
    const bv = to.props[field.key] ?? IDENTITY[field.key];
    out[field.key] = av + (bv - av) * t;
  }
  return out;
}

function transformText(props: PropValues): string {
  const parts: string[] = [];
  if (props.translateX || props.translateY) {
    parts.push(`translate(${props.translateX}px, ${props.translateY}px)`);
  }
  if (props.rotateX) {
    parts.push(`rotateX(${props.rotateX}deg)`);
  }
  if (props.rotateY) {
    parts.push(`rotateY(${props.rotateY}deg)`);
  }
  if (props.rotateZ) {
    parts.push(`rotateZ(${props.rotateZ}deg)`);
  }
  if (props.screw) {
    parts.push(`skew(${props.screw}deg)`);
  }
  if (props.scale !== 1) {
    parts.push(`scale(${props.scale})`);
  }
  return parts.join(' ');
}

export function AnimationEditorModal({ open, animation, onCancel, onSave }: AnimationEditorModalProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [keyframes, setKeyframes] = useState<AnimationKeyframe[]>([]);
  const [percent, setPercent] = useState(0);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'loop' | 'alternate'>('loop');
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<
    { type: 'pan'; x: number; y: number } | { type: 'playhead' } | { type: 'keyframe'; offset: number } | null
  >(null);
  const modeRef = useRef(playMode);

  useEffect(() => {
    modeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      return;
    }
    const initial =
      animation && animation.keyframes.length > 0 ? sortKeyframes(animation.keyframes) : [{ offset: 0, props: {} }];
    setName(animation?.name ?? '');
    setKeyframes(initial);
    setPercent(0);
    setSelectedOffset(null);
    setPlaying(false);
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, [open, animation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left - rect.width / 2;
      const my = event.clientY - rect.top - rect.height / 2;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((current) => {
        const zoom = Math.min(8, Math.max(0.1, current.zoom * factor));
        const k = zoom / current.zoom;
        return { zoom, panX: mx - k * (mx - current.panX), panY: my - k * (my - current.panY) };
      });
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [open]);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      if (drag.type === 'pan') {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        dragRef.current = { type: 'pan', x: event.clientX, y: event.clientY };
        setView((current) => ({ ...current, panX: current.panX + dx, panY: current.panY + dy }));
        return;
      }
      const track = trackRef.current;
      if (!track) {
        return;
      }
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }
      const next = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
      if (drag.type === 'playhead') {
        setPercent(next);
        return;
      }
      const previous = drag.offset;
      dragRef.current = { type: 'keyframe', offset: next };
      setSelectedOffset(next);
      setPercent(next);
      setKeyframes((current) =>
        sortKeyframes(current.map((frame) => (frame.offset === previous ? { ...frame, offset: next } : frame))),
      );
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let direction = 1;
    const state = { start: performance.now() };
    let raf = requestAnimationFrame(function tick(now: number) {
      let progress = (now - state.start) / PLAY_DURATION;
      while (progress >= 1) {
        direction = modeRef.current === 'alternate' ? -direction : 1;
        state.start += PLAY_DURATION;
        progress = (now - state.start) / PLAY_DURATION;
      }
      const value = direction > 0 ? progress * 100 : (1 - progress) * 100;
      setPercent(clampPercent(value));
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const selectedKeyframe = selectedOffset == null ? undefined : keyframes.find((frame) => frame.offset === selectedOffset);
  const current = sampleProps(keyframes, percent);
  const transform = transformText(current);

  function updateProp(key: PropKey, value: number) {
    const target = selectedKeyframe ? selectedKeyframe.offset : clampPercent(percent);
    setKeyframes((frames) => {
      const index = frames.findIndex((frame) => frame.offset === target);
      if (index >= 0) {
        const next = [...frames];
        const props: AnimationProps = { ...next[index].props };
        props[key] = value;
        next[index] = { ...next[index], props };
        return sortKeyframes(next);
      }
      const props: AnimationProps = { ...sampleProps(frames, target) };
      props[key] = value;
      return sortKeyframes([...frames, { offset: target, props }]);
    });
    if (!selectedKeyframe) {
      setSelectedOffset(target);
    }
  }

  function addKeyframe() {
    const offset = clampPercent(percent);
    setKeyframes((frames) =>
      frames.some((frame) => frame.offset === offset)
        ? frames
        : sortKeyframes([...frames, { offset, props: { ...sampleProps(frames, offset) } }]),
    );
    setSelectedOffset(offset);
  }

  function deleteKeyframe() {
    if (selectedOffset == null) {
      return;
    }
    setKeyframes((frames) => frames.filter((frame) => frame.offset !== selectedOffset));
    setSelectedOffset(null);
  }

  function onCanvasMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    dragRef.current = { type: 'pan', x: event.clientX, y: event.clientY };
    event.preventDefault();
  }

  function onTrackMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    setSelectedOffset(null);
    setPercent(clampPercent(((event.clientX - rect.left) / rect.width) * 100));
    dragRef.current = { type: 'playhead' };
    event.preventDefault();
  }

  function onMarkerMouseDown(event: ReactMouseEvent<HTMLDivElement>, offset: number) {
    event.stopPropagation();
    event.preventDefault();
    setSelectedOffset(offset);
    setPercent(offset);
    dragRef.current = { type: 'keyframe', offset };
  }

  async function handleSave() {
    await onSave({ name: name.trim(), keyframes: sortKeyframes(keyframes) });
  }

  return (
    <Modal
      title={t('lowcode.animationEdit')}
      open={open}
      width={960}
      onCancel={onCancel}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('lowcode.animationCancel')}
        </Button>,
        <Button key="save" type="primary" disabled={!name.trim()} onClick={() => void handleSave()}>
          {t('lowcode.animationSave')}
        </Button>,
      ]}
    >
      <div style={styles.body}>
        <div style={styles.nameRow}>
          <span>{t('lowcode.animationName')}</span>
          <Input
            value={name}
            maxLength={64}
            style={{ maxWidth: 320 }}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div style={styles.split}>
          <div ref={canvasRef} style={styles.canvas} onMouseDown={onCanvasMouseDown}>
            <div
              style={{
                ...styles.canvasLayer,
                transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
              }}
            >
              <div style={{ ...styles.triangleWrap, transform: transform || 'none', opacity: current.opacity }}>
                <svg width={120} height={120} viewBox="0 0 100 100">
                  <polygon points="50,10 90,80 10,80" fill="#1677ff" />
                </svg>
              </div>
            </div>
            <div style={styles.canvasToolbar} onMouseDown={(event) => event.stopPropagation()}>
              <Button size="small" onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>
                {t('lowcode.animationReset')}
              </Button>
              <Button size="small" onClick={() => setView((current) => ({ ...current, zoom: Math.min(8, current.zoom * 1.2) }))}>
                {t('lowcode.animationZoomIn')}
              </Button>
              <Button size="small" onClick={() => setView((current) => ({ ...current, zoom: Math.max(0.1, current.zoom / 1.2) }))}>
                {t('lowcode.animationZoomOut')}
              </Button>
            </div>
            <div style={styles.canvasCoord}>
              {t('lowcode.animationCanvasCoord', {
                zoom: view.zoom.toFixed(2),
                x: Math.round(view.panX),
                y: Math.round(view.panY),
              })}
            </div>
          </div>
          <div style={styles.fields}>
            {PROP_FIELDS.map((field) => (
              <div key={field.key} style={styles.field}>
                <span style={styles.fieldLabel}>{field.label}</span>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={current[field.key]}
                  onChange={(value) => updateProp(field.key, typeof value === 'number' ? value : IDENTITY[field.key])}
                />
              </div>
            ))}
          </div>
        </div>
        <div style={styles.timeline}>
          <div style={styles.timelineControls}>
            <Button
              size="small"
              icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? t('lowcode.animationPause') : t('lowcode.animationPlay')}
            </Button>
            <Select
              size="small"
              style={{ width: 120 }}
              value={playMode}
              onChange={(value: 'loop' | 'alternate') => setPlayMode(value)}
              options={[
                { value: 'loop', label: t('lowcode.animationLoop') },
                { value: 'alternate', label: t('lowcode.animationAlternate') },
              ]}
            />
            <span style={styles.percent}>{percent.toFixed(1)}%</span>
            <Button size="small" icon={<PlusOutlined />} onClick={addKeyframe}>
              {t('lowcode.animationAddKeyframe')}
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedOffset == null}
              onClick={deleteKeyframe}
            >
              {t('lowcode.animationDeleteKeyframe')}
            </Button>
          </div>
          <div ref={trackRef} style={styles.track} onMouseDown={onTrackMouseDown}>
            <div style={{ ...styles.trackFill, width: `${percent}%` }} />
            <div style={{ ...styles.playhead, left: `${percent}%` }} />
            {keyframes.map((frame) => (
              <div
                key={frame.offset}
                style={{
                  ...styles.marker,
                  left: `${frame.offset}%`,
                  ...(frame.offset === selectedOffset ? styles.markerActive : null),
                }}
                onMouseDown={(event) => onMarkerMouseDown(event, frame.offset)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
