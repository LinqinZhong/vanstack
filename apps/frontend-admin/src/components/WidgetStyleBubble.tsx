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
  PictureOutlined,
  RadiusSettingOutlined,
  RotateRightOutlined,
  ThunderboltOutlined,
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
  DEFAULT_TABLE_HEADER_HEIGHT,
  MIN_TABLE_TRACK,
  TABLE_LINE_STYLES,
  compactTableLine,
  compactTableLines,
  OVERFLOW_MODES,
  POSITION_MODES,
  TABLE_ALIGNS,
  TABLE_VALIGNS,
  isCopyBinding,
  hasWidgetEvents,
  isLoopConfigured,
  isStateFnConfigured,
  widgetEventSpecs,
  sanitizeWidgetStyle,
  type OverflowMode,
  type PageI18n,
  type PageVariable,
  type PageWidget,
  type PositionMode,
  type TableAlign,
  type TableLine,
  type TableLineStyle,
  type TableLines,
  type TableValign,
  type WidgetLoop,
  type WidgetStyle,
} from '@vanstack/xml';
import { AssetImagePicker } from './AssetLibraryPanel';
import { IconPicker } from './IconLibraryPanel';
import { CopyI18nPicker } from './CopyI18nPicker';
import { StyleBoxEdges, pxFromLength } from './StyleBoxEdges';
import { AngleField, SizeField, fontFamilyOptions } from './WidgetStyleFields';
import { WidgetEventPanel } from './WidgetEventPanel';
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

export type BoxGroup = 'content' | 'margin' | 'padding' | 'radius' | 'border' | 'size' | 'overflow' | 'position' | 'rotate' | 'loop' | 'events';

export type TableCommand =
  | 'add-column'
  | 'remove-column'
  | 'move-column-left'
  | 'move-column-right'
  | 'add-row'
  | 'remove-row'
  | 'move-row-up'
  | 'move-row-down';

export type TableBubbleModel = {
  headerHeight: number | null;
  onHeaderHeight?: (value: number) => void;
  hideCopy?: boolean;
  align?: TableAlign;
  valign?: TableValign;
  onAlign?: (value: TableAlign | undefined) => void;
  onValign?: (value: TableValign | undefined) => void;
};

export function isBoxGroupAllowed(type: PageWidget['type'], group: BoxGroup) {
  if (group === 'loop' || group === 'events') {
    return true;
  }
  if (type === 'tr') {
    return false;
  }
  if (type === 'th' || type === 'td') {
    return group === 'padding' || group === 'radius';
  }
  if (group === 'overflow') {
    return type === 'text' || type === 'input' || type === 'flex' || type === 'table';
  }
  if (
    type === 'swiper-item' &&
    (group === 'size' || group === 'margin' || group === 'radius' || group === 'border' || group === 'position')
  ) {
    return false;
  }
  if (type === 'icon' && group === 'size') {
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
  inherited,
  onClick,
}: {
  label: ReactNode;
  active: boolean;
  inherited?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={['widget-style-bubble-toggle', inherited, active ? 'is-active' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
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
  buttonClassName,
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
  buttonClassName?: string;
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
          <button type="button" className={['widget-style-bubble-color', buttonClassName].filter(Boolean).join(' ')}>
            {kind === 'font' ? (
              <span
                className="widget-style-bubble-color-letter"
                style={colorValue(color) ? { color } : undefined}
              >
                A
              </span>
            ) : (
              <HighlightOutlined />
            )}
          </button>
        </ColorPicker>
      </span>
    </Tooltip>
  );

  return (
    <BindingLock bound={bound} resetKey={resetKey} onContinue={() => onOpenChange?.(true)}>
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
  onSrcChange,
  onLoopChange,
  onEventsChange,
  onStateFnChange,
  onOpenInspector,
  i18nCatalog,
  projectId,
  variables,
  disabled,
  onToolbarPopupChange,
  ownKeys,
  table,
  onTableLines,
  onStyleDelta,
}: {
  widget: PageWidget;
  style?: WidgetStyle;
  openGroup: BoxGroup | null;
  onOpenGroupChange: (group: BoxGroup | null) => void;
  onChange: (style: WidgetStyle | undefined) => void;
  onStyleDelta?: (delta: Partial<WidgetStyle>) => void;
  onTextChange?: (text: string) => void;
  onSrcChange?: (src: string) => void;
  projectId?: string;
  onLoopChange?: (loop: WidgetLoop | undefined) => void;
  onEventsChange?: (events: PageWidget['events']) => void;
  onStateFnChange?: (stateFn: string | undefined, hoverStateId?: string) => void;
  onOpenInspector: () => void;
  i18nCatalog?: PageI18n;
  variables?: PageVariable[];
  disabled?: boolean;
  onToolbarPopupChange?: (open: boolean) => void;
  ownKeys?: Set<string>;
  table?: TableBubbleModel;
  onTableLines?: (lines: TableLines | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const modifier = modifierShortcutLabel();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = style ?? {};
  const isInherited = (key: string) => (ownKeys ? !ownKeys.has(key) : false);
  const hasValue = (key: string) => {
    const v = (current as Record<string, unknown>)[key];
    return v != null && v !== '' && v !== false;
  };
  const inheritedClass = (key: string, active?: boolean) => {
    if (!isInherited(key) || !hasValue(key)) return undefined;
    return active ? 'widget-style-inherited-active' : 'widget-style-inherited';
  };
  const display: WidgetStyle = current;
  const Inherited = ({ active, children }: { active?: boolean; children: ReactNode }) =>
    active ? <div className="widget-style-inherited">{children}</div> : <>{children}</>;
  const showText =
    widget.type === 'text' ||
    widget.type === 'button' ||
    widget.type === 'checkbox' ||
    (widget.type === 'input' && !widget.modelValue?.trim()) ||
    ((widget.type === 'th' || widget.type === 'td') && !table?.hideCopy);
  const content =
    widget.type === 'text' || widget.type === 'th' || widget.type === 'td' || widget.type === 'input'
      ? widget.value
      : widget.type === 'button' || widget.type === 'checkbox'
        ? widget.text
        : '';
  const [textShadow, setTextShadow] = useState(() => parseCssShadow(display.textShadow));
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
    if (onStyleDelta) {
      onStyleDelta(next);
      return;
    }
    const merged = { ...current, ...next };
    onChange(sanitizeWidgetStyle(widget.type, merged));
  }

  function patchTableLine(kind: keyof TableLines, partial: Partial<TableLine>) {
    if (disabled || widget.type !== 'table' || !onTableLines) {
      return;
    }
    const prev = widget.lines?.[kind] ?? {};
    const merged: TableLine = { ...prev, ...partial };
    if ('width' in partial && (partial.width == null || partial.width <= 0)) {
      delete merged.width;
    }
    if ('style' in partial && !partial.style) {
      delete merged.style;
    }
    if ('color' in partial && !partial.color) {
      delete merged.color;
    }
    let line = compactTableLine(merged);
    if (line && line.width == null && (line.style || line.color)) {
      line = { ...line, width: 1 };
    }
    onTableLines(compactTableLines({ ...widget.lines, [kind]: line }));
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
          {widget.type === 'image' && projectId && onSrcChange ? (
            <AssetImagePicker projectId={projectId} disabled={disabled} onPick={onSrcChange} />
          ) : widget.type === 'image' ? (
            <Tooltip title={t('lowcode.assetsPickImage')}>
              <Button size="small" type="text" icon={<PictureOutlined />} disabled />
            </Tooltip>
          ) : null}
          {widget.type === 'icon' && projectId && onSrcChange ? (
            <IconPicker projectId={projectId} disabled={disabled} onPick={onSrcChange} />
          ) : widget.type === 'icon' ? (
            <Tooltip title={t('lowcode.iconsPickIcon')}>
              <Button size="small" type="text" icon={<PictureOutlined />} disabled />
            </Tooltip>
          ) : null}
          {widget.type === 'icon' ? (
            <ColorIconPicker
              title={t('lowcode.styleColor')}
              kind="font"
              color={display.color}
              buttonClassName={inheritedClass('color')}
              resetKey={widget.id}
              getPopupContainer={popupContainer}
              {...popupProps('icon-color')}
              onChange={(css) => patch({ color: css })}
            />
          ) : null}
          {showText ? (
            <>
              <BindingLock
                bound={isInherited('fontFamily') ? undefined : current.fontFamily}
                resetKey={widget.id}
                onContinue={() => popupProps('font-family').onOpenChange(true)}
              >
                <Select
                size="small"
                className={['widget-style-bubble-font', inheritedClass('fontFamily')].filter(Boolean).join(' ')}
                allowClear
                value={display.fontFamily}
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
                  className={['widget-style-bubble-fontsize', inheritedClass('fontSize')].filter(Boolean).join(' ')}
                  min={1}
                  max={999}
                  controls
                  value={display.fontSize}
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
                <BindingLock
                  bound={isInherited('fontWeight') ? undefined : current.fontWeight}
                  resetKey={widget.id}
                  onContinue={() =>
                    patch({
                      fontWeight: isInherited('fontWeight')
                        ? current.fontWeight === '700' ? '400' : '700'
                        : current.fontWeight === '700' ? undefined : '700',
                    })
                  }
                >
                  <ToggleButton
                    label={<BoldOutlined />}
                    active={current.fontWeight === '700'}
                    inherited={inheritedClass('fontWeight', current.fontWeight === '700')}
                    onClick={() =>
                      patch({
                        fontWeight: isInherited('fontWeight')
                          ? current.fontWeight === '700' ? '400' : '700'
                          : current.fontWeight === '700' ? undefined : '700',
                      })
                    }
                  />
                </BindingLock>
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleItalic')} (${modifier}+I)`}>
                <ToggleButton
                  label={<ItalicOutlined />}
                  active={Boolean(current.italic)}
                  inherited={inheritedClass('italic', Boolean(current.italic))}
                  onClick={() =>
                    patch({ italic: isInherited('italic') ? !current.italic : current.italic ? undefined : true })
                  }
                />
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleUnderline')} (${modifier}+U)`}>
                <ToggleButton
                  label={<UnderlineOutlined />}
                  active={Boolean(current.underline)}
                  inherited={inheritedClass('underline', Boolean(current.underline))}
                  onClick={() =>
                    patch({ underline: isInherited('underline') ? !current.underline : current.underline ? undefined : true })
                  }
                />
              </Tooltip>
              <Tooltip title={`${t('lowcode.styleLineThrough')} (${modifier}+D)`}>
                <ToggleButton
                  label={<StrikethroughOutlined />}
                  active={Boolean(current.lineThrough)}
                  inherited={inheritedClass('lineThrough', Boolean(current.lineThrough))}
                  onClick={() =>
                    patch({ lineThrough: isInherited('lineThrough') ? !current.lineThrough : current.lineThrough ? undefined : true })
                  }
                />
              </Tooltip>
              <ColorIconPicker
                title={t('lowcode.styleColor')}
                kind="font"
                color={display.color}
                bound={isInherited('color') ? undefined : current.color}
                buttonClassName={inheritedClass('color')}
                resetKey={widget.id}
                getPopupContainer={popupContainer}
                {...popupProps('font-color')}
                onChange={(css) => patch({ color: css })}
              />
              <Tooltip title={t('lowcode.styleTextShadow')}>
                <BindingLock
                  bound={isInherited('textShadow') ? undefined : current.textShadow}
                  resetKey={widget.id}
                  onContinue={() =>
                    popupProps('text-shadow').onOpenChange(true)
                  }
                >
                  <ColorPicker
                    size="small"
                    className={inheritedClass('textShadow')}
                    allowClear
                    destroyOnHidden
                    value={colorValue(textShadow.color)}
                    getPopupContainer={popupContainer}
                    {...popupProps('text-shadow')}
                    onChange={(value, css) => patchTextShadow({ color: value.cleared ? '' : css })}
                  />
                </BindingLock>
              </Tooltip>
            </>
          ) : null}
          {(widget.type === 'th' || widget.type === 'td') && table?.onAlign && table.onValign ? (
            <>
              <Tooltip title={t('lowcode.tableAlign')}>
                <Select
                  size="small"
                  value={table.align ?? 'start'}
                  disabled={disabled}
                  popupMatchSelectWidth={false}
                  getPopupContainer={() => document.body}
                  onMouseDown={(event) => event.stopPropagation()}
                  options={TABLE_ALIGNS.map((value) => ({ value, label: t(`lowcode.tableAlign${value.charAt(0).toUpperCase()}${value.slice(1)}`) }))}
                  onChange={(align: TableAlign) => table.onAlign?.(align === 'start' ? undefined : align)}
                />
              </Tooltip>
              <Tooltip title={t('lowcode.tableValign')}>
                <Select
                  size="small"
                  value={table.valign ?? 'middle'}
                  disabled={disabled}
                  popupMatchSelectWidth={false}
                  getPopupContainer={() => document.body}
                  onMouseDown={(event) => event.stopPropagation()}
                  options={TABLE_VALIGNS.map((value) => ({ value, label: t(`lowcode.tableValign${value.charAt(0).toUpperCase()}${value.slice(1)}`) }))}
                  onChange={(valign: TableValign) => table.onValign?.(valign === 'middle' ? undefined : valign)}
                />
              </Tooltip>
            </>
          ) : null}
          {widget.type !== 'tr' ? (
          <ColorIconPicker
            title={t('lowcode.styleBackground')}
            kind="fill"
            allowClear={widget.type !== 'button'}
            color={display.background || (widget.type === 'button' ? DEFAULT_BUTTON_BACKGROUND : undefined)}
            bound={isInherited('background') ? undefined : current.background}
            buttonClassName={inheritedClass('background')}
            resetKey={widget.id}
            getPopupContainer={popupContainer}
            {...popupProps('background')}
            onChange={(css, cleared) =>
              patch({
                background: cleared && widget.type === 'button' ? DEFAULT_BUTTON_BACKGROUND : css,
              })
            }
          />
          ) : null}
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
                type={isStateFnConfigured(widget.stateFn) || widget.hoverStateId ? 'primary' : 'text'}
                icon={<ControlOutlined />}
                onClick={() => setStateFnOpen(true)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('lowcode.styleEvents')}>
            <Button
              size="small"
              type={openGroup === 'events' || hasWidgetEvents(widget.events) ? 'primary' : 'text'}
              icon={<ThunderboltOutlined />}
              onClick={() => toggleGroup('events')}
            />
          </Tooltip>
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
                <Inherited active={!!inheritedClass('width')}>
                  <SizeField
                    label={t('lowcode.styleWidth')}
                    size={display.width}
                    allowFit={widget.type !== 'swiper'}
                    fallback={widget.type === 'swiper' ? DEFAULT_SWIPER_WIDTH : undefined}
                    onChange={(width) => patch({ width })}
                  />
                </Inherited>
                <Inherited active={!!inheritedClass('height')}>
                  <SizeField
                    label={t('lowcode.styleHeight')}
                    size={display.height}
                    allowFit={widget.type !== 'swiper'}
                    fallback={widget.type === 'swiper' ? DEFAULT_SWIPER_HEIGHT : undefined}
                    onChange={(height) => patch({ height })}
                  />
                </Inherited>
              </div>
            ) : null}
            {openGroup === 'overflow' && isBoxGroupAllowed(widget.type, 'overflow') ? (
              <div className="style-size-panel">
                <Select
                  size="small"
                  className={inheritedClass('overflow')}
                  value={
                    (OVERFLOW_MODES as readonly string[]).includes(display.overflow ?? '')
                      ? (display.overflow as OverflowMode)
                      : widget.type === 'table'
                        ? 'auto'
                        : 'visible'
                  }
                  getPopupContainer={popupContainer}
                  onChange={(overflow: OverflowMode) =>
                    patch({
                      overflow:
                        widget.type === 'table'
                          ? overflow === 'auto'
                            ? undefined
                            : overflow
                          : overflow === 'visible'
                            ? undefined
                            : overflow,
                    })
                  }
                  options={OVERFLOW_MODES.map((value) => ({
                    value,
                    label: t(`lowcode.styleOverflow${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                  }))}
                />
                {widget.type === 'table' && table?.onHeaderHeight ? (
                  <Tooltip title={t('lowcode.tableHeaderHeight')}>
                    <InputNumber
                      size="small"
                      min={MIN_TABLE_TRACK}
                      precision={0}
                      value={table.headerHeight ?? DEFAULT_TABLE_HEADER_HEIGHT}
                      disabled={disabled}
                      onChange={(value) => {
                        if (value != null) table.onHeaderHeight?.(value);
                      }}
                    />
                  </Tooltip>
                ) : null}
              </div>
            ) : null}
            {openGroup === 'position' && isBoxGroupAllowed(widget.type, 'position') ? (
              <div className="style-size-panel">
                <Select
                  size="small"
                  className={inheritedClass('position')}
                  value={
                    (POSITION_MODES as readonly string[]).includes(display.position ?? '')
                      ? (display.position as PositionMode)
                      : 'static'
                  }
                  getPopupContainer={popupContainer}
                  onChange={(position: PositionMode) =>
                    patch({ position: position === 'static' ? undefined : position })
                  }
                  options={POSITION_MODES.map((value) => ({
                    value,
                    label: t(`lowcode.stylePosition${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                  }))}
                />
                {display.position ? (
                  <>
                    <StyleBoxEdges
                      resetKey={`${widget.id}:position`}
                      showPreview={false}
                      units={['px', '%']}
                      lengthKind="inset"
                      popupContainer={popupContainer}
                      ownKeys={ownKeys}
                      edgeKeys={{ top: 'top', right: 'right', bottom: 'bottom', left: 'left' }}
                      baseValues={{ top: current.top, right: current.right, bottom: current.bottom, left: current.left }}
                      values={{
                        top: display.top,
                        right: display.right,
                        bottom: display.bottom,
                        left: display.left,
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
                        className={inheritedClass('zIndex')}
                        value={display.zIndex}
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
                ownKeys={ownKeys}
                edgeKeys={{ top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' }}
                baseValues={{ top: current.marginTop, right: current.marginRight, bottom: current.marginBottom, left: current.marginLeft }}
                values={{
                  top: display.marginTop,
                  right: display.marginRight,
                  bottom: display.marginBottom,
                  left: display.marginLeft,
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
                ownKeys={ownKeys}
                edgeKeys={{ top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' }}
                baseValues={{ top: current.paddingTop, right: current.paddingRight, bottom: current.paddingBottom, left: current.paddingLeft }}
                values={{
                  top: display.paddingTop,
                  right: display.paddingRight,
                  bottom: display.paddingBottom,
                  left: display.paddingLeft,
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
                  stroke={{ color: display.borderTopColor ?? display.borderColor, style: display.borderTopStyle ?? display.borderStyle }}
                  ownKeys={ownKeys}
                  edgeKeys={{ top: 'borderTopWidth', right: 'borderRightWidth', bottom: 'borderBottomWidth', left: 'borderLeftWidth' }}
                  baseValues={{ top: current.borderTopWidth, right: current.borderRightWidth, bottom: current.borderBottomWidth, left: current.borderLeftWidth }}
                  values={{
                    top: display.borderTopWidth,
                    right: display.borderRightWidth,
                    bottom: display.borderBottomWidth,
                    left: display.borderLeftWidth,
                  }}
                  lines={{
                    style: {
                      top: display.borderTopStyle ?? display.borderStyle,
                      right: display.borderRightStyle ?? display.borderStyle,
                      bottom: display.borderBottomStyle ?? display.borderStyle,
                      left: display.borderLeftStyle ?? display.borderStyle,
                    },
                    color: {
                      top: display.borderTopColor ?? display.borderColor,
                      right: display.borderRightColor ?? display.borderColor,
                      bottom: display.borderBottomColor ?? display.borderColor,
                      left: display.borderLeftColor ?? display.borderColor,
                    },
                  }}
                  linePopup={(id) => popupProps(`border-line-${id}`)}
                  onLineChange={(lines) => {
                    const widths = {
                      top: current.borderTopWidth,
                      right: current.borderRightWidth,
                      bottom: current.borderBottomWidth,
                      left: current.borderLeftWidth,
                    };
                    patch({
                      borderTopStyle: lines.style.top,
                      borderRightStyle: lines.style.right,
                      borderBottomStyle: lines.style.bottom,
                      borderLeftStyle: lines.style.left,
                      borderTopColor: lines.color.top,
                      borderRightColor: lines.color.right,
                      borderBottomColor: lines.color.bottom,
                      borderLeftColor: lines.color.left,
                      borderTopWidth: lines.style.top || lines.color.top ? widths.top ?? 1 : widths.top,
                      borderRightWidth: lines.style.right || lines.color.right ? widths.right ?? 1 : widths.right,
                      borderBottomWidth: lines.style.bottom || lines.color.bottom ? widths.bottom ?? 1 : widths.bottom,
                      borderLeftWidth: lines.style.left || lines.color.left ? widths.left ?? 1 : widths.left,
                    });
                  }}
                  onChange={(quad) => {
                    const widths = {
                      top: pxFromLength(quad.top),
                      right: pxFromLength(quad.right),
                      bottom: pxFromLength(quad.bottom),
                      left: pxFromLength(quad.left),
                    };
                    const styles = {
                      top: current.borderTopStyle ?? current.borderStyle,
                      right: current.borderRightStyle ?? current.borderStyle,
                      bottom: current.borderBottomStyle ?? current.borderStyle,
                      left: current.borderLeftStyle ?? current.borderStyle,
                    };
                    patch({
                      borderTopWidth: widths.top,
                      borderRightWidth: widths.right,
                      borderBottomWidth: widths.bottom,
                      borderLeftWidth: widths.left,
                      borderTopStyle: widths.top ? styles.top || 'solid' : styles.top,
                      borderRightStyle: widths.right ? styles.right || 'solid' : styles.right,
                      borderBottomStyle: widths.bottom ? styles.bottom || 'solid' : styles.bottom,
                      borderLeftStyle: widths.left ? styles.left || 'solid' : styles.left,
                    });
                  }}
                />
                {widget.type === 'table' && onTableLines ? (
                  <div className="table-line-fields">
                    {(['header', 'row', 'column'] as const).map((kind) => {
                      const line = widget.lines?.[kind];
                      const labelKey = kind === 'header' ? 'tableLineHeader' : kind === 'row' ? 'tableLineRow' : 'tableLineColumn';
                      return (
                        <div className="table-line-row" key={kind}>
                          <span className="table-line-row-label">{t(`lowcode.${labelKey}`)}</span>
                          <InputNumber
                            size="small"
                            min={0}
                            max={20}
                            precision={0}
                            value={line?.width}
                            disabled={disabled}
                            onChange={(value) => patchTableLine(kind, { width: value ?? undefined })}
                          />
                          <Select
                            size="small"
                            allowClear
                            value={line?.style}
                            disabled={disabled}
                            placeholder={t('lowcode.styleBorderNone')}
                            popupMatchSelectWidth={false}
                            getPopupContainer={popupContainer}
                            onChange={(value: TableLineStyle | null) => patchTableLine(kind, { style: value || undefined })}
                            options={TABLE_LINE_STYLES.map((value) => ({
                              value,
                              label: t(`lowcode.styleBorder${value.charAt(0).toUpperCase()}${value.slice(1)}`),
                            }))}
                          />
                          <BindingLock
                            bound={line?.color && isCopyBinding(line.color) ? line.color : undefined}
                            resetKey={`${widget.id}:${kind}-line`}
                            onContinue={() => popupProps(`table-line-${kind}`).onOpenChange(true)}
                          >
                            <ColorPicker
                              size="small"
                              allowClear
                              destroyOnHidden
                              value={colorValue(line?.color)}
                              disabled={disabled}
                              getPopupContainer={popupContainer}
                              {...popupProps(`table-line-${kind}`)}
                              onChange={(value, css) => patchTableLine(kind, { color: value.cleared ? undefined : css })}
                            />
                          </BindingLock>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {openGroup === 'radius' && isBoxGroupAllowed(widget.type, 'radius') ? (
              <StyleBoxEdges
                resetKey={`${widget.id}:radius`}
                kind="corners"
                min={0}
                max={999}
                showPreview={false}
                ownKeys={ownKeys}
                edgeKeys={{ top: 'radiusTopLeft', right: 'radiusTopRight', bottom: 'radiusBottomRight', left: 'radiusBottomLeft' }}
                baseValues={{ top: current.radiusTopLeft, right: current.radiusTopRight, bottom: current.radiusBottomRight, left: current.radiusBottomLeft }}
                values={{
                  top: display.radiusTopLeft,
                  right: display.radiusTopRight,
                  bottom: display.radiusBottomRight,
                  left: display.radiusBottomLeft,
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
                <Inherited active={!!inheritedClass('rotateX')}>
                  <AngleField
                    label={t('lowcode.styleRotateX')}
                    angle={display.rotateX}
                    popupContainer={popupContainer}
                    onChange={(rotateX) => patch({ rotateX })}
                  />
                </Inherited>
                <Inherited active={!!inheritedClass('rotateY')}>
                  <AngleField
                    label={t('lowcode.styleRotateY')}
                    angle={display.rotateY}
                    popupContainer={popupContainer}
                    onChange={(rotateY) => patch({ rotateY })}
                  />
                </Inherited>
                <Inherited active={!!inheritedClass('rotateZ')}>
                  <AngleField
                    label={t('lowcode.styleRotateZ')}
                    angle={display.rotateZ}
                    popupContainer={popupContainer}
                    onChange={(rotateZ) => patch({ rotateZ })}
                  />
                </Inherited>
              </div>
            ) : null}
            {openGroup === 'events' && onEventsChange ? (
              <WidgetEventPanel
                specs={widgetEventSpecs(widget.type)}
                events={widget.events}
                scopeKey={widget.id}
                projectId={projectId}
                disabled={disabled}
                onChange={onEventsChange}
              />
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
            onChange={(stateFn, hoverStateId) => {
              onStateFnChange(stateFn, hoverStateId);
              setStateFnOpen(false);
            }}
          />
        ) : null}
      </div>
    </ConfigProvider>
  );
}
