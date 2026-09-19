import {
  BoldOutlined,
  BorderInnerOutlined,
  BorderOutlined,
  BorderOuterOutlined,
  ColumnWidthOutlined,
  ControlOutlined,
  CodeOutlined,
  DragOutlined,
  EditOutlined,
  ExpandOutlined,
  HighlightOutlined,
  ItalicOutlined,
  RadiusSettingOutlined,
  RotateRightOutlined,
  UnorderedListOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import { Button, ColorPicker, ConfigProvider, Input, InputNumber, Modal, Select, theme, Tooltip } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SWIPER_HEIGHT,
  DEFAULT_SWIPER_WIDTH,
  OVERFLOW_MODES,
  POSITION_MODES,
  isCopyBinding,
  isLoopConfigured,
  isStateFnConfigured,
  sanitizeWidgetStyle,
  type OverflowMode,
  type PageI18n,
  type PageVariable,
  type PageWidget,
  type PositionMode,
  type WidgetLoop,
  type WidgetStyle,
} from '@vanstack/xml';
import { CopyI18nPicker } from './CopyI18nPicker';
import { StyleBoxEdges, pxFromLength } from './StyleBoxEdges';
import { AngleField, SizeField, fontFamilyOptions } from './WidgetStyleFields';
import { WidgetLoopPanel } from './WidgetLoopPanel';
import { WidgetStateFnModal } from './WidgetStateFnModal';
import { modifierShortcutLabel } from '../utils/widgetShortcuts';

type ShadowValue = {
  x: number;
  y: number;
  blur: number;
  color: string;
};

const DEFAULT_SHADOW: ShadowValue = { x: 0, y: 0, blur: 4, color: '' };
const DEFAULT_BUTTON_BACKGROUND = '#ffffff';

export type BoxGroup = 'content' | 'margin' | 'padding' | 'radius' | 'border' | 'size' | 'overflow' | 'position' | 'rotate' | 'loop';

export function isBoxGroupAllowed(type: PageWidget['type'], group: BoxGroup) {
  if (group === 'loop') {
    return true;
  }
  if (group === 'overflow') {
    return type === 'text' || type === 'flex';
  }
  if (
    type === 'swiper-item' &&
    (group === 'size' || group === 'margin' || group === 'radius' || group === 'border' || group === 'position')
  ) {
    return false;
  }
  if (type === 'swiper' && group === 'padding') {
    return false;
  }
  return true;
}

function parseCssShadow(value: string | undefined): ShadowValue {
  if (!value?.trim()) {
    return { ...DEFAULT_SHADOW };
  }

  const match = value
    .trim()
    .match(
      /^(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)?(?:\s+(\d+(?:\.\d+)?)(?:px)?)?\s+(.+)$/,
    );
  if (!match) {
    return { ...DEFAULT_SHADOW, color: value };
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    blur: Number(match[3]),
    color: match[5].trim(),
  };
}

function formatCssShadow(shadow: ShadowValue) {
  if (!shadow.color) {
    return undefined;
  }
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`;
}

function colorValue(value: string | undefined) {
  if (!value || isCopyBinding(value)) {
    return null;
  }
  return value;
}

function BindingLock({
  bound,
  resetKey,
  children,
  onContinue,
}: {
  bound?: string;
  resetKey?: string;
  children: ReactNode;
  onContinue?: () => void;
}) {
  const { t } = useTranslation();
  const [released, setReleased] = useState(false);
  const locked = isCopyBinding(bound ?? '') && !released;

  useEffect(() => {
    setReleased(false);
  }, [resetKey, bound]);

  function confirm(event: { preventDefault(): void; stopPropagation(): void }) {
    event.preventDefault();
    event.stopPropagation();
    Modal.confirm({
      title: t('lowcode.styleBindingOverwrite'),
      onOk: () => {
        setReleased(true);
        onContinue?.();
      },
    });
  }

  return (
    <span
      className="widget-style-binding"
      data-bound={locked ? '' : undefined}
      onMouseDownCapture={locked ? confirm : undefined}
    >
      {children}
    </span>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="small"
      type={active ? 'primary' : 'text'}
      className="widget-style-bubble-toggle"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function ColorIconPicker({
  title,
  color,
  kind,
  allowClear = true,
  open,
  getPopupContainer,
  onOpenChange,
  onChange,
  resetKey,
  bound,
}: {
  title: string;
  color?: string;
  kind: 'font' | 'fill';
  allowClear?: boolean;
  open?: boolean;
  getPopupContainer: () => HTMLElement;
  onOpenChange?: (open: boolean) => void;
  onChange: (css: string | undefined, cleared: boolean) => void;
  resetKey?: string;
  bound?: string;
}) {
  const picker = (
    <Tooltip title={title} open={open ? false : undefined}>
      <span>
        <ColorPicker
          size="small"
          allowClear={allowClear}
          destroyOnHidden
          open={open}
          value={colorValue(color)}
          getPopupContainer={getPopupContainer}
          onOpenChange={onOpenChange}
          onChange={(value, css) => onChange(value.cleared ? undefined : css, value.cleared)}
        >
          <button type="button" className="widget-style-bubble-color">
            {kind === 'font' ? (
              <span className="widget-style-bubble-color-letter">A</span>
            ) : (
              <HighlightOutlined />
            )}
            <span
              className="widget-style-bubble-color-bar"
              style={colorValue(color) ? { backgroundColor: color } : undefined}
              data-empty={!colorValue(color) || undefined}
            />
          </button>
        </ColorPicker>
      </span>
    </Tooltip>
  );

  return (
    <BindingLock bound={bound ?? color} resetKey={resetKey} onContinue={() => onOpenChange?.(true)}>
      {picker}
    </BindingLock>
  );
}

export function WidgetStyleBubble({
  widget,
  style,
  openGroup,
  onOpenGroupChange,
  onChange,
  onTextChange,
  onLoopChange,
  onStateFnChange,
  onOpenInspector,
  i18nCatalog,
  variables,
  disabled,
  onToolbarPopupChange,
}: {
  widget: PageWidget;
  style?: WidgetStyle;
  openGroup: BoxGroup | null;
  onOpenGroupChange: (group: BoxGroup | null) => void;
  onChange: (style: WidgetStyle | undefined) => void;
  onTextChange?: (text: string) => void;
  onLoopChange?: (loop: WidgetLoop | undefined) => void;
  onStateFnChange?: (stateFn: string | undefined) => void;
  onOpenInspector: () => void;
  i18nCatalog?: PageI18n;
  variables?: PageVariable[];
  disabled?: boolean;
  onToolbarPopupChange?: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const modifier = modifierShortcutLabel();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = style ?? {};
  const showText = widget.type === 'text' || widget.type === 'button';
  const content = widget.type === 'text' ? widget.value : widget.type === 'button' ? widget.text : '';
  const [textShadow, setTextShadow] = useState(() => parseCssShadow(current.textShadow));
  const [openPopup, setOpenPopup] = useState<string | null>(null);
  const [stateFnOpen, setStateFnOpen] = useState(false);

  const onToolbarPopupChangeRef = useRef(onToolbarPopupChange);
  onToolbarPopupChangeRef.current = onToolbarPopupChange;

  useEffect(() => {
    setTextShadow(parseCssShadow(style?.textShadow));
  }, [widget.id, style?.textShadow]);

  useEffect(() => {
    onToolbarPopupChangeRef.current?.(openPopup != null);
  }, [openPopup]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }
    function onClose() {
      setOpenPopup(null);
    }
    node.addEventListener('vanstack-close-toolbar-popup', onClose);
    return () => node.removeEventListener('vanstack-close-toolbar-popup', onClose);
  }, []);

  function popupProps(id: string) {
    return {
      open: openPopup === id,
      onOpenChange: (open: boolean) => {
        setOpenPopup((currentPopup) => (open ? id : currentPopup === id ? null : currentPopup));
      },
    };
  }

  function popupContainer() {
    return rootRef.current ?? document.body;
  }

  function patch(next: Partial<WidgetStyle>) {
    if (disabled) {
      return;
    }
    const merged = { ...current, ...next };
    onChange(sanitizeWidgetStyle(widget.type, merged));
  }

  function patchTextShadow(next: Partial<ShadowValue>) {
    const shadow = { ...textShadow, ...next };
    setTextShadow(shadow);
    patch({ textShadow: formatCssShadow(shadow) });
  }

  function toggleGroup(group: BoxGroup) {
    onOpenGroupChange(openGroup === group ? null : group);
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <div
        ref={rootRef}
        className="widget-style-bubble"
        data-toolbar-popup={openPopup ? '' : undefined}
      >
        <div className="widget-style-bubble-toolbar">
          {showText ? (
            <>
              <BindingLock
                bound={current.fontFamily}
                resetKey={widget.id}
                onContinue={() => popupProps('font-family').onOpenChange(true)}
              >
                <Select
                size="small"
                className="widget-style-bubble-font"
                allowClear
                value={current.fontFamily}
                placeholder={t('lowcode.styleFontDefault')}
                popupMatchSelectWidth={false}
                getPopupContainer={() => document.body}
                onMouseDown={(event) => event.stopPropagation()}
                {...popupProps('font-family')}
                options={fontFamilyOptions(i18n.language)}
                onChange={(fontFamily) => patch({ fontFamily: fontFamily || undefined })}
              />
              </BindingLock>
              <Tooltip title={`${t('lowcode.styleFontSize')} (${modifier}+. / ${modifier}+-)`}>
                <InputNumber
                  size="small"
                  className="widget-style-bubble-fontsize"
                  min={1}
                  max={999}
                  controls
                  value={current.fontSize}
                  placeholder="px"
                  suffix="px"
                  onMouseDown={(event) => event.stopPropagation()}
                  onChange={(fontSize) => patch({ fontSize: fontSize ?? undefined })}
                />
              </Tooltip>
              <Tooltip title={t('lowcode.propEdit')}>
                <Button
                  size="small"
                  type={openGroup === 'content' ? 'primary' : 'text'}
                  icon={<EditOutlined />}
                  onClick={() => toggleGroup('content')}
                />
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleBold')} (${modifier}+B)`}>
                <span>
                  <BindingLock
                    bound={current.fontWeight}
                    resetKey={widget.id}
                    onContinue={() =>
                      patch({ fontWeight: current.fontWeight === '700' ? undefined : '700' })
                    }
                  >
                    <ToggleButton
                      label={<BoldOutlined />}
                      active={current.fontWeight === '700'}
                      onClick={() => patch({ fontWeight: current.fontWeight === '700' ? undefined : '700' })}
                    />
                  </BindingLock>
                </span>
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleItalic')} (${modifier}+I)`}>
                <span>
                  <ToggleButton
                    label={<ItalicOutlined />}
                    active={Boolean(current.italic)}
                    onClick={() => patch({ italic: current.italic ? undefined : true })}
                  />
                </span>
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleUnderline')} (${modifier}+U)`}>
                <span>
                  <ToggleButton
                    label={<UnderlineOutlined />}
                    active={Boolean(current.underline)}
                    onClick={() => patch({ underline: current.underline ? undefined : true })}
                  />
                </span>
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleLineThrough')} (${modifier}+D)`}>
                <span>
                  <ToggleButton
                    label={<StrikethroughOutlined />}
                    active={Boolean(current.lineThrough)}
                    onClick={() => patch({ lineThrough: current.lineThrough ? undefined : true })}
                  />
                </span>
              </Tooltip>
              <ColorIconPicker
                title={t('lowcode.styleColor')}
                kind="font"
                color={current.color}
                resetKey={widget.id}
                getPopupContainer={popupContainer}
                {...popupProps('font-color')}
                onChange={(css) => patch({ color: css })}
              />
              <Tooltip title={t('lowcode.styleTextShadow')}>
                <span>
                  <BindingLock
                    bound={current.textShadow}
                    resetKey={widget.id}
                    onContinue={() =>
                      popupProps('text-shadow').onOpenChange(true)
                    }
                  >
                    <ColorPicker
                    size="small"
                    allowClear
                    destroyOnHidden
                    value={colorValue(textShadow.color)}
                    getPopupContainer={popupContainer}
                    {...popupProps('text-shadow')}
                    onChange={(value, css) => patchTextShadow({ color: value.cleared ? '' : css })}
                  />
                  </BindingLock>
                </span>
              </Tooltip>
            </>
          ) : null}
          <ColorIconPicker
            title={t('lowcode.styleBackground')}
            kind="fill"
            allowClear={widget.type !== 'button'}
            color={current.background || (widget.type === 'button' ? DEFAULT_BUTTON_BACKGROUND : undefined)}
            bound={current.background}
            resetKey={widget.id}
            getPopupContainer={popupContainer}
            {...popupProps('background')}
            onChange={(css, cleared) =>
              patch({
                background: cleared && widget.type === 'button' ? DEFAULT_BUTTON_BACKGROUND : css,
              })
            }
          />
          {isBoxGroupAllowed(widget.type, 'size') ? (
            <Tooltip title={`${t('lowcode.styleSize')} (${modifier}+T)`}>
              <Button
                size="small"
                type={openGroup === 'size' ? 'primary' : 'text'}
                icon={<ColumnWidthOutlined />}
                onClick={() => toggleGroup('size')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'position') ? (
            <Tooltip title={`${t('lowcode.stylePosition')} (${modifier}+L)`}>
              <Button
                size="small"
                type={openGroup === 'position' ? 'primary' : 'text'}
                icon={<DragOutlined />}
                onClick={() => toggleGroup('position')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'margin') ? (
            <Tooltip title={`${t('lowcode.styleMargin')} (${modifier}+M)`}>
              <Button
                size="small"
                type={openGroup === 'margin' ? 'primary' : 'text'}
                icon={<BorderOuterOutlined />}
                onClick={() => toggleGroup('margin')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'padding') ? (
            <Tooltip title={`${t('lowcode.stylePadding')} (${modifier}+P)`}>
              <Button
                size="small"
                type={openGroup === 'padding' ? 'primary' : 'text'}
                icon={<BorderInnerOutlined />}
                onClick={() => toggleGroup('padding')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'radius') ? (
            <Tooltip title={`${t('lowcode.styleBorderRadius')} (${modifier}+R)`}>
              <Button
                size="small"
                type={openGroup === 'radius' ? 'primary' : 'text'}
                icon={<RadiusSettingOutlined />}
                onClick={() => toggleGroup('radius')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'border') ? (
            <Tooltip title={`${t('lowcode.styleBorder')} (${modifier}+Shift+B)`}>
              <Button
                size="small"
                type={openGroup === 'border' ? 'primary' : 'text'}
                icon={<BorderOutlined />}
                onClick={() => toggleGroup('border')}
              />
            </Tooltip>
          ) : null}
          {isBoxGroupAllowed(widget.type, 'rotate') ? (
            <Tooltip title={`${t('lowcode.styleRotate')} (${modifier}+Shift+R)`}>
              <Button
                size="small"
                type={openGroup === 'rotate' ? 'primary' : 'text'}
                icon={<RotateRightOutlined />}
                onClick={() => toggleGroup('rotate')}
              />
            </Tooltip>
          ) : null}
          {onStateFnChange ? (
            <Tooltip title={t('lowcode.styleState')}>
              <Button
                size="small"
                type={isStateFnConfigured(widget.stateFn) ? 'primary' : 'text'}
                icon={<ControlOutlined />}
                onClick={() => setStateFnOpen(true)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('lowcode.styleLoop')}>
            <Button
              size="small"
              type={isLoopConfigured(widget.loop) ? 'primary' : 'text'}
              icon={<UnorderedListOutlined />}
              onClick={() => toggleGroup('loop')}
            />
          </Tooltip>
          {isBoxGroupAllowed(widget.type, 'overflow') ? (
            <Tooltip title={t('lowcode.styleOverflow')}>
              <Button
                size="small"
                type={openGroup === 'overflow' ? 'primary' : 'text'}
                icon={<ExpandOutlined />}
                onClick={() => toggleGroup('overflow')}
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('lowcode.styleSettings')}>
            <Button
              size="small"
              type="text"
              icon={<CodeOutlined />}
              onClick={onOpenInspector}
            />
          </Tooltip>
        </div>
        {openGroup ? (
          <div className="widget-style-bubble-panel">
            {openGroup === 'content' && onTextChange ? (
              <div className="widget-style-bubble-text-row">
                <Input.TextArea
                  autoFocus
                  className="widget-style-bubble-text"
                  rows={5}
                  disabled={disabled}
                  value={content}
                  onChange={(event) => {
                    if (disabled) {
                      return;
                    }
                    onTextChange(event.target.value);
                  }}
                />
                <CopyI18nPicker catalog={i18nCatalog} onPick={onTextChange} />
              </div>
            ) : null}
            {openGroup === 'size' && isBoxGroupAllowed(widget.type, 'size') ? (
              <div className="style-size-panel">
                <SizeField
                  label={t('lowcode.styleWidth')}
                  size={current.width}
                  allowFit={widget.type !== 'swiper'}
                  fallback={widget.type === 'swiper' ? DEFAULT_SWIPER_WIDTH : undefined}
                  onChange={(width) => patch({ width })}
                />
                <SizeField
                  label={t('lowcode.styleHeight')}
                  size={current.height}
                  allowFit={widget.type !== 'swiper'}
                  fallback={widget.type === 'swiper' ? DEFAULT_SWIPER_HEIGHT : undefined}
                  onChange={(height) => patch({ height })}
                />
              </div>
            ) : null}
            {openGroup === 'overflow' && isBoxGroupAllowed(widget.type, 'overflow') ? (
              <div className="style-size-panel">
                <Select
                  size="small"
                  value={current.overflow ?? 'visible'}
                  getPopupContainer={popupContainer}
                  onChange={(overflow: OverflowMode) =>
                    patch({ overflow: overflow === 'visible' ? undefined : overflow })
                  }
                  options={OVERFLOW_MODES.map((value) => ({
                    value,
                    label: t(`lowcode.styleOverflow${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                  }))}
                />
              </div>
            ) : null}
            {openGroup === 'position' && isBoxGroupAllowed(widget.type, 'position') ? (
              <div className="style-size-panel">
                <Select
                  size="small"
                  value={current.position ?? 'static'}
                  getPopupContainer={popupContainer}
                  onChange={(position: PositionMode) =>
                    patch({ position: position === 'static' ? undefined : position })
                  }
                  options={POSITION_MODES.map((value) => ({
                    value,
                    label: t(`lowcode.stylePosition${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                  }))}
                />
                {current.position ? (
                  <>
                    <StyleBoxEdges
                      resetKey={`${widget.id}:position`}
                      showPreview={false}
                      units={['px', '%']}
                      lengthKind="inset"
                      popupContainer={popupContainer}
                      values={{
                        top: current.top,
                        right: current.right,
                        bottom: current.bottom,
                        left: current.left,
                      }}
                      onChange={(quad) =>
                        patch({
                          top: quad.top,
                          right: quad.right,
                          bottom: quad.bottom,
                          left: quad.left,
                        })
                      }
                    />
                    <div className="style-box-row">
                      <span className="style-box-row-label">{t('lowcode.styleZIndex')}</span>
                      <InputNumber
                        size="small"
                        step={1}
                        precision={0}
                        value={current.zIndex}
                        onChange={(value) =>
                          patch({
                            zIndex:
                              typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined,
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {openGroup === 'margin' && isBoxGroupAllowed(widget.type, 'margin') ? (
              <StyleBoxEdges
                resetKey={`${widget.id}:margin`}
                showPreview={false}
                units={['px', '%', 'auto']}
                lengthKind="margin"
                popupContainer={popupContainer}
                values={{
                  top: current.marginTop,
                  right: current.marginRight,
                  bottom: current.marginBottom,
                  left: current.marginLeft,
                }}
                onChange={(quad) =>
                  patch({
                    marginTop: quad.top,
                    marginRight: quad.right,
                    marginBottom: quad.bottom,
                    marginLeft: quad.left,
                  })
                }
              />
            ) : null}
            {openGroup === 'padding' && isBoxGroupAllowed(widget.type, 'padding') ? (
              <StyleBoxEdges
                resetKey={`${widget.id}:padding`}
                min={0}
                showPreview={false}
                units={['px', '%']}
                lengthKind="padding"
                popupContainer={popupContainer}
                values={{
                  top: current.paddingTop,
                  right: current.paddingRight,
                  bottom: current.paddingBottom,
                  left: current.paddingLeft,
                }}
                onChange={(quad) =>
                  patch({
                    paddingTop: quad.top,
                    paddingRight: quad.right,
                    paddingBottom: quad.bottom,
                    paddingLeft: quad.left,
                  })
                }
              />
            ) : null}
            {openGroup === 'border' && isBoxGroupAllowed(widget.type, 'border') ? (
              <div className="style-border-fields">
                <StyleBoxEdges
                  resetKey={`${widget.id}:border`}
                  min={0}
                  max={20}
                  showPreview={false}
                  stroke={{ color: current.borderColor, style: current.borderStyle }}
                  values={{
                    top: current.borderTopWidth,
                    right: current.borderRightWidth,
                    bottom: current.borderBottomWidth,
                    left: current.borderLeftWidth,
                  }}
                  onChange={(quad) => {
                    const hasWidth = [quad.top, quad.right, quad.bottom, quad.left].some((value) => pxFromLength(value));
                    patch({
                      borderTopWidth: pxFromLength(quad.top),
                      borderRightWidth: pxFromLength(quad.right),
                      borderBottomWidth: pxFromLength(quad.bottom),
                      borderLeftWidth: pxFromLength(quad.left),
                      borderStyle: hasWidth ? current.borderStyle || 'solid' : current.borderStyle,
                    });
                  }}
                />
                <div className="style-border-meta">
                  <BindingLock bound={current.borderStyle} resetKey={widget.id}>
                    <Select
                    size="small"
                    allowClear
                    value={current.borderStyle}
                    placeholder={t('lowcode.styleBorderNone')}
                    getPopupContainer={popupContainer}
                    onChange={(borderStyle) => patch({ borderStyle: borderStyle || undefined })}
                    options={[
                      { value: 'solid', label: t('lowcode.styleBorderSolid') },
                      { value: 'dashed', label: t('lowcode.styleBorderDashed') },
                      { value: 'dotted', label: t('lowcode.styleBorderDotted') },
                    ]}
                  />
                  </BindingLock>
                  <BindingLock
                    bound={current.borderColor}
                    resetKey={widget.id}
                    onContinue={() => popupProps('border-color').onOpenChange(true)}
                  >
                    <ColorPicker
                    size="small"
                    allowClear
                    destroyOnHidden
                    value={colorValue(current.borderColor)}
                    getPopupContainer={popupContainer}
                    {...popupProps('border-color')}
                    onChange={(value, css) => patch({ borderColor: value.cleared ? undefined : css })}
                  />
                  </BindingLock>
                </div>
              </div>
            ) : null}
            {openGroup === 'radius' && isBoxGroupAllowed(widget.type, 'radius') ? (
              <StyleBoxEdges
                resetKey={`${widget.id}:radius`}
                kind="corners"
                min={0}
                max={999}
                showPreview={false}
                values={{
                  top: current.radiusTopLeft,
                  right: current.radiusTopRight,
                  bottom: current.radiusBottomRight,
                  left: current.radiusBottomLeft,
                }}
                onChange={(quad) =>
                  patch({
                    radiusTopLeft: pxFromLength(quad.top),
                    radiusTopRight: pxFromLength(quad.right),
                    radiusBottomRight: pxFromLength(quad.bottom),
                    radiusBottomLeft: pxFromLength(quad.left),
                  })
                }
              />
            ) : null}
            {openGroup === 'rotate' && isBoxGroupAllowed(widget.type, 'rotate') ? (
              <div className="style-size-panel">
                <AngleField
                  label={t('lowcode.styleRotateX')}
                  angle={current.rotateX}
                  popupContainer={popupContainer}
                  onChange={(rotateX) => patch({ rotateX })}
                />
                <AngleField
                  label={t('lowcode.styleRotateY')}
                  angle={current.rotateY}
                  popupContainer={popupContainer}
                  onChange={(rotateY) => patch({ rotateY })}
                />
                <AngleField
                  label={t('lowcode.styleRotateZ')}
                  angle={current.rotateZ}
                  popupContainer={popupContainer}
                  onChange={(rotateZ) => patch({ rotateZ })}
                />
              </div>
            ) : null}
            {openGroup === 'loop' && onLoopChange ? (
              <WidgetLoopPanel
                widget={widget}
                variables={variables ?? []}
                disabled={disabled}
                popupContainer={popupContainer}
                onChange={onLoopChange}
              />
            ) : null}
          </div>
        ) : null}
        {onStateFnChange ? (
          <WidgetStateFnModal
            open={stateFnOpen}
            widget={widget}
            variables={variables ?? []}
            disabled={disabled}
            onCancel={() => setStateFnOpen(false)}
            onChange={(stateFn) => {
              onStateFnChange(stateFn);
              setStateFnOpen(false);
            }}
          />
        ) : null}
      </div>
    </ConfigProvider>
  );
}
