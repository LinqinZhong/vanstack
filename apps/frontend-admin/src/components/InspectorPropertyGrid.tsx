import { DisconnectOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popover, Select, Tabs, Tooltip, type InputRef } from 'antd';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FLEX_ALIGN_CONTENTS,
  FLEX_ALIGN_ITEMS,
  FLEX_ALIGN_SELFS,
  FLEX_DIRECTIONS,
  FLEX_DISPLAYS,
  FLEX_JUSTIFY_CONTENTS,
  FLEX_WRAPS,
  INPUT_TYPES,
  OVERFLOW_MODES,
  inputModelDataType,
  SWIPER_EASINGS,
  compactFlexContainer,
  compactFlexItem,
  compactPageStyle,
  compactSize,
  compactSwiper,
  compactBoxLength,
  formatBoxLength,
  formatAngle,
  parseBoxLength,
  parseAngle,
  boxLengthsEqual,
  DEFAULT_SWIPER_HEIGHT,
  DEFAULT_SWIPER_WIDTH,
  isCopyBinding,
  propModelName,
  validateDataLiteral,
  type ComponentProp,
  type ComponentPropType,
  sanitizeWidgetStyle,
  type BoxLength,
  type AngleValue,
  type FlexAlignContent,
  type FlexAlignItems,
  type FlexAlignSelf,
  type FlexContainerStyle,
  type FlexDirection,
  type FlexDisplay,
  type FlexItemStyle,
  type FlexJustifyContent,
  type FlexWrap,
  type PageStyle,
  type PageVariable,
  type PageWidget,
  type PageI18n,
  type SizeValue,
  type SwiperEasing,
  type SwiperStyle,
  type WidgetStyle,
} from '@vanstack/xml';
import type { WidgetPatch } from '../utils/widgetTree';
import { AssetImagePicker } from './AssetLibraryPanel';
import { IconPicker } from './IconLibraryPanel';
import { CopyI18nPicker } from './CopyI18nPicker';

type BoxQuad = {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
};

type InspectorProp = {
  key: string;
  label?: string;
  hint?: string;
  copyTools?: boolean;
  value: string;
  onChange: (raw: string) => boolean;
  picker?: 'image' | 'icon' | 'model';
  options?: { value: string; label: string }[];
  bind?: {
    name: string;
    options: { value: string; label: string }[];
    onChange: (name: string) => void;
  };
  skipTextTools?: boolean;
  disabled?: boolean;
  category?: 'basic' | 'style';
  inherited?: boolean;
  placeholder?: string;
  suffix?: string;
};

function ModelBindButton({
  disabled,
  name,
  options,
  onChange,
}: {
  disabled?: boolean;
  name: string;
  options: { value: string; label: string }[];
  onChange: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (name) {
    return (
      <span className="inspector-prop-edit">
        <Tooltip title={t('lowcode.modelValueUnbind')}>
          <Button
            size="small"
            type="text"
            disabled={disabled}
            icon={<DisconnectOutlined />}
            onClick={() => onChange('')}
          />
        </Tooltip>
      </span>
    );
  }
  const content = options.length ? (
    <div className="copy-i18n-picker">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="copy-i18n-picker-item"
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.dataEmpty')} />
  );
  return (
    <span className="inspector-prop-edit">
      <Popover trigger="click" open={open && !disabled} onOpenChange={setOpen} content={content} destroyOnHidden>
        <Tooltip title={t('lowcode.modelValuePick')}>
          <Button size="small" type="text" disabled={disabled} icon={<LinkOutlined />} />
        </Tooltip>
      </Popover>
    </span>
  );
}

type LengthQuad = {
  top?: BoxLength | string;
  right?: BoxLength | string;
  bottom?: BoxLength | string;
  left?: BoxLength | string;
};

function formatLength(value?: BoxLength | string) {
  if (typeof value === 'string') {
    return value;
  }
  return value ? formatBoxLength(value) : '';
}

function sameLength(a?: BoxLength | string, b?: BoxLength | string) {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }
  return boxLengthsEqual(a, b);
}

function parseRotateInput(raw: string): AngleValue | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = parseAngle(trimmed);
  if (parsed) {
    return parsed;
  }
  if (/^[+-]?(?:0+(?:\.0+)?|\.0+)(?:deg|rad|grad|turn)?$/i.test(trimmed)) {
    return undefined;
  }
  return false;
}

function parseLength(raw: string, kind: 'margin' | 'padding' | 'inset'): BoxLength | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const parsed = parseBoxLength(trimmed, {
    allowAuto: kind === 'margin',
    allowNegative: kind !== 'padding',
  });
  if (!parsed) {
    return false;
  }
  return compactBoxLength(parsed, kind);
}

function formatLengthBox(values: LengthQuad) {
  const { top, right, bottom, left } = values;
  if (top == null && right == null && bottom == null && left == null) {
    return '';
  }
  if (top == null || right == null || bottom == null || left == null) {
    return '';
  }
  if (sameLength(top, right) && sameLength(right, bottom) && sameLength(bottom, left)) {
    return formatLength(top);
  }
  if (sameLength(top, bottom) && sameLength(left, right)) {
    return `${formatLength(top)} ${formatLength(right)}`;
  }
  if (sameLength(left, right)) {
    return `${formatLength(top)} ${formatLength(right)} ${formatLength(bottom)}`;
  }
  return `${formatLength(top)} ${formatLength(right)} ${formatLength(bottom)} ${formatLength(left)}`;
}

function parseLengthBox(raw: string, kind: 'margin' | 'padding' | 'inset'): LengthQuad | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { top: undefined, right: undefined, bottom: undefined, left: undefined };
  }
  if (isCopyBinding(trimmed)) {
    return { top: trimmed, right: trimmed, bottom: trimmed, left: trimmed };
  }
  const parts = trimmed.split(/\s+/).map((part) => parseLength(part, kind));
  if (parts.length === 0 || parts.length > 4 || parts.some((part) => part === false)) {
    return false;
  }
  const lens = parts as Array<BoxLength | undefined>;
  if (lens.length === 1) {
    return { top: lens[0], right: lens[0], bottom: lens[0], left: lens[0] };
  }
  if (lens.length === 2) {
    return { top: lens[0], right: lens[1], bottom: lens[0], left: lens[1] };
  }
  if (lens.length === 3) {
    return { top: lens[0], right: lens[1], bottom: lens[2], left: lens[1] };
  }
  return { top: lens[0], right: lens[1], bottom: lens[2], left: lens[3] };
}

function formatPx(value?: number | string) {
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? '' : `${value}px`;
}

function parseCssColor(raw: string): string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', trimmed) ? trimmed : false;
  }
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^(?:rgb|rgba|hsl|hsla)\(/i.test(trimmed)) {
    return trimmed;
  }
  return false;
}

function parseFontWeight(raw: string): string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (/^(?:normal|bold|lighter|bolder|[1-9]00)$/i.test(trimmed)) {
    return trimmed;
  }
  return false;
}

function parseFontFamily(raw: string): string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function parseFontSize(raw: string): number | string | undefined | false {
  const parsed = parsePx(raw);
  if (typeof parsed === 'string' || parsed === false || parsed === undefined) {
    return parsed;
  }
  return parsed > 0 ? parsed : false;
}

function parseCssShadow(raw: string, property: 'text-shadow' | 'box-shadow'): string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'none') {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports(property, trimmed) ? trimmed : false;
  }
  return trimmed;
}

function parsePx(raw: string): number | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
  if (!match) {
    return false;
  }
  return Number(match[1]);
}

function formatBox(values: BoxQuad) {
  const { top, right, bottom, left } = values;
  if (top == null && right == null && bottom == null && left == null) {
    return '';
  }
  if (top == null || right == null || bottom == null || left == null) {
    return '';
  }
  if (top === right && right === bottom && bottom === left) {
    return formatPx(top);
  }
  if (top === bottom && left === right) {
    return `${formatPx(top)} ${formatPx(right)}`;
  }
  if (left === right) {
    return `${formatPx(top)} ${formatPx(right)} ${formatPx(bottom)}`;
  }
  return `${formatPx(top)} ${formatPx(right)} ${formatPx(bottom)} ${formatPx(left)}`;
}

function parseBox(raw: string): BoxQuad | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { top: undefined, right: undefined, bottom: undefined, left: undefined };
  }
  if (isCopyBinding(trimmed)) {
    return { top: trimmed, right: trimmed, bottom: trimmed, left: trimmed };
  }
  const parts = trimmed.split(/\s+/).map((part) => parsePx(part));
  if (parts.length === 0 || parts.length > 4 || parts.some((part) => part === false)) {
    return false;
  }
  const nums = parts as number[];
  if (nums.length === 1) {
    return { top: nums[0], right: nums[0], bottom: nums[0], left: nums[0] };
  }
  if (nums.length === 2) {
    return { top: nums[0], right: nums[1], bottom: nums[0], left: nums[1] };
  }
  if (nums.length === 3) {
    return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[1] };
  }
  return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[3] };
}

function formatSize(size?: SizeValue | string) {
  if (typeof size === 'string') {
    return size;
  }
  return size ? `${size.value}${size.mode}` : '';
}

function parseSize(raw: string): SizeValue | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'fit-content') {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(px|%)?$/i);
  if (!match) {
    return false;
  }
  const mode = (match[2]?.toLowerCase() || 'px') as 'px' | '%';
  return compactSize({ mode, value: Number(match[1]) }) ?? undefined;
}

function formatBool(value?: boolean | string) {
  if (typeof value === 'string') {
    return value;
  }
  return value ? 'true' : '';
}

function parseBool(raw: string): boolean | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const token = trimmed.toLowerCase();
  if (token === 'true' || token === '1' || token === 'yes') {
    return true;
  }
  if (token === 'false' || token === '0' || token === 'no') {
    return false;
  }
  return false;
}

function parseEnum<T extends string>(raw: string, values: readonly T[]): T | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  return (values as readonly string[]).includes(trimmed) ? (trimmed as T) : false;
}

function parseBorderStyle(raw: string): string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  return parseEnum(raw, ['solid', 'dashed', 'dotted'] as const);
}

function parseNumber(raw: string, min?: number): number | string | undefined | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return false;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || (min != null && value < min)) {
    return false;
  }
  return value;
}

function formatTextDecoration(style?: WidgetStyle) {
  if (typeof style?.underline === 'string' || typeof style?.lineThrough === 'string') {
    if (style.underline === style.lineThrough && typeof style.underline === 'string') {
      return style.underline;
    }
    return [typeof style.underline === 'string' ? style.underline : '', typeof style.lineThrough === 'string' ? style.lineThrough : '']
      .filter(Boolean)
      .join(' ');
  }
  const parts = [style?.underline ? 'underline' : '', style?.lineThrough ? 'line-through' : ''].filter(Boolean);
  return parts.join(' ');
}

function parseTextDecoration(raw: string): { underline?: boolean | string; lineThrough?: boolean | string } | false {
  const trimmed = raw.trim();
  if (isCopyBinding(trimmed)) {
    return { underline: trimmed, lineThrough: trimmed };
  }
  const token = trimmed.toLowerCase();
  if (!token || token === 'none') {
    return { underline: undefined, lineThrough: undefined };
  }
  const parts = token.split(/\s+/);
  let underline: boolean | undefined;
  let lineThrough: boolean | undefined;
  for (const part of parts) {
    if (part === 'underline') {
      underline = true;
      continue;
    }
    if (part === 'line-through') {
      lineThrough = true;
      continue;
    }
    return false;
  }
  return { underline, lineThrough };
}

function formatFontStyle(italic?: boolean | string) {
  if (typeof italic === 'string') {
    return italic;
  }
  return italic ? 'italic' : '';
}

function parseFontStyle(raw: string): boolean | string | undefined | false {
  const trimmed = raw.trim();
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const token = trimmed.toLowerCase();
  if (!token || token === 'normal') {
    return undefined;
  }
  if (token === 'italic') {
    return true;
  }
  return false;
}

function formatFlexBasis(value?: FlexItemStyle['flexBasis']) {
  if (value == null) {
    return '';
  }
  return value === 'auto' ? 'auto' : formatPx(value);
}

function parseFlexBasis(raw: string): FlexItemStyle['flexBasis'] | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (trimmed === 'auto') {
    return 'auto';
  }
  const px = parsePx(trimmed);
  return px === false ? false : px;
}

function accepted<T>(parsed: T | false, apply: (value: T) => void) {
  if (parsed === false) {
    return false;
  }
  apply(parsed);
  return true;
}

function PropertyInput({
  propKey,
  value,
  disabled,
  onChange,
  onInvalidChange,
  placeholder,
  suffix,
}: {
  propKey: string;
  value: string;
  disabled?: boolean;
  onChange: (raw: string) => boolean;
  onInvalidChange: (key: string, invalid: boolean) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!focused && !invalid) {
      setDraft(value);
    }
  }, [focused, invalid, value]);

  useLayoutEffect(() => {
    const caret = caretRef.current;
    if (!focused || !caret) {
      return;
    }
    inputRef.current?.setSelectionRange(caret.start, caret.end);
  }, [draft, focused]);

  useEffect(() => {
    return () => onInvalidChange(propKey, false);
  }, [onInvalidChange, propKey]);

  function commit(next: string) {
    const ok = onChange(next);
    setInvalid(!ok);
    onInvalidChange(propKey, !ok);
    return ok;
  }

  return (
    <Input
      ref={inputRef}
      size="small"
      disabled={disabled}
      status={invalid ? 'error' : undefined}
      placeholder={placeholder}
      suffix={suffix}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const node = event.target;
        caretRef.current = {
          start: node.selectionStart ?? node.value.length,
          end: node.selectionEnd ?? node.value.length,
        };
        const next = node.value;
        setDraft(next);
        commit(next);
      }}
      onBlur={() => {
        caretRef.current = null;
        setFocused(false);
        commit(draft);
      }}
    />
  );
}

function PropertyGrid({
  items,
  disabled,
  resetKey,
  onInvalidChange,
  i18nCatalog,
  projectId,
}: {
  items: InspectorProp[];
  disabled?: boolean;
  resetKey?: string;
  onInvalidChange?: (invalid: boolean) => void;
  i18nCatalog?: PageI18n;
  projectId?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<InspectorProp | null>(null);
  const [editorDraft, setEditorDraft] = useState('');
  const invalidKeys = useRef(new Set<string>());
  const onInvalidChangeRef = useRef(onInvalidChange);
  onInvalidChangeRef.current = onInvalidChange;

  useEffect(() => {
    setQuery('');
    setEditing(null);
    invalidKeys.current.clear();
    onInvalidChangeRef.current?.(false);
  }, [resetKey]);

  function reportInvalid(key: string, invalid: boolean) {
    const has = invalidKeys.current.has(key);
    if (invalid === has) {
      return;
    }
    if (invalid) {
      invalidKeys.current.add(key);
    } else {
      invalidKeys.current.delete(key);
    }
    onInvalidChangeRef.current?.(invalidKeys.current.size > 0);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!needle) {
        return true;
      }
      const label = (item.label ?? t(`lowcode.prop.${item.key}`, { defaultValue: item.key })).toLowerCase();
      return item.key.toLowerCase().includes(needle) || label.includes(needle) || (item.hint ?? '').toLowerCase().includes(needle);
    });
  }, [items, query, t]);

  const basicItems = visible.filter((item) => item.category === 'basic');
  const styleItems = visible.filter((item) => item.category !== 'basic');
  const hasBasic = items.some((item) => item.category === 'basic');

  const renderItem = (item: InspectorProp) => (
    <div
      key={`${resetKey ?? ''}:${item.key}`}
      className={`inspector-prop${item.inherited ? ' is-inherited' : ''}`}
      title={item.hint ?? item.label ?? item.key}
    >
      <span className="inspector-prop-label">{item.label ?? item.key}</span>
      <div className="inspector-prop-value">
        {item.picker === 'model' ? (
          <Select
            size="small"
            allowClear
            disabled={disabled || item.disabled}
            value={item.value || undefined}
            placeholder={item.placeholder}
            options={item.options}
            onChange={(value) => item.onChange(value ?? '')}
          />
        ) : (
          <PropertyInput
            propKey={item.key}
            disabled={disabled || item.disabled}
            value={item.value}
            onChange={item.onChange}
            onInvalidChange={reportInvalid}
            placeholder={item.placeholder}
            suffix={item.suffix}
          />
        )}
        {item.bind ? (
          <ModelBindButton
            disabled={disabled}
            name={item.bind.name}
            options={item.bind.options}
            onChange={item.bind.onChange}
          />
        ) : null}
        {(item.copyTools || item.key === 'value' || item.key === 'text' || item.key === 'placeholder') && !item.skipTextTools ? (
          <>
            <CopyI18nPicker
              catalog={i18nCatalog}
              disabled={disabled || item.disabled}
              onPick={(expression) => item.onChange(expression)}
            />
            <Tooltip title={t('lowcode.propEdit')}>
              <Button
                size="small"
                type="text"
                className="inspector-prop-edit"
                disabled={disabled || item.disabled}
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(item);
                  setEditorDraft(item.value);
                }}
              />
            </Tooltip>
          </>
        ) : null}
        {item.key === 'src' ? (
          <>
            {projectId && item.picker === 'image' ? (
              <AssetImagePicker
                projectId={projectId}
                disabled={disabled || item.disabled}
                onPick={(url) => item.onChange(url)}
              />
            ) : null}
            {projectId && item.picker === 'icon' ? (
              <IconPicker
                projectId={projectId}
                disabled={disabled || item.disabled}
                onPick={(url) => item.onChange(url)}
              />
            ) : null}
            <Tooltip title={t('lowcode.propEdit')}>
              <Button
                size="small"
                type="text"
                className="inspector-prop-edit"
                disabled={disabled || item.disabled}
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(item);
                  setEditorDraft(item.value);
                }}
              />
            </Tooltip>
          </>
        ) : null}
      </div>
    </div>
  );

  const renderGrid = (list: InspectorProp[]) =>
    list.length ? (
      <div className="inspector-prop-grid">{list.map((item) => renderItem(item))}</div>
    ) : (
      <div className="inspector-prop-empty">{t('lowcode.propFilterEmpty')}</div>
    );

  return (
    <div className="inspector-props">
      <Input
        allowClear
        className="inspector-prop-filter"
        placeholder={t('lowcode.propFilter')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {hasBasic ? (
        <Tabs
          size="small"
          defaultActiveKey="basic"
          className="inspector-props-tabs"
          items={[
            {
              key: 'basic',
              label: t('lowcode.propTabBasic'),
              children: renderGrid(basicItems),
            },
            {
              key: 'style',
              label: t('lowcode.propTabStyle'),
              children: renderGrid(styleItems),
            },
          ]}
        />
      ) : visible.length ? (
        <div className="inspector-prop-grid">{visible.map((item) => renderItem(item))}</div>
      ) : (
        <div className="inspector-prop-empty">{t('lowcode.propFilterEmpty')}</div>
      )}
      <Modal
        className="inspector-text-modal"
        open={Boolean(editing)}
        title={editing?.label ?? editing?.key}
        okText={t('lowcode.propEditConfirm')}
        cancelText={t('lowcode.propEditCancel')}
        onOk={() => {
          if (!editing) {
            return;
          }
          editing.onChange(editorDraft);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Input.TextArea
          autoFocus
          rows={10}
          value={editorDraft}
          disabled={disabled}
          onChange={(event) => setEditorDraft(event.target.value)}
        />
        {editing?.copyTools || editing?.key === 'value' || editing?.key === 'text' || editing?.key === 'placeholder' ? (
          <div className="inspector-text-modal-i18n">
            <CopyI18nPicker
              catalog={i18nCatalog}
              disabled={disabled || editing?.disabled}
              onPick={(expression) => setEditorDraft(expression)}
            />
          </div>
        ) : null}
        {editing?.key === 'src' && projectId && editing.picker === 'image' ? (
          <div className="inspector-text-modal-i18n">
            <AssetImagePicker
              projectId={projectId}
              disabled={disabled || editing?.disabled}
              onPick={(url) => {
                setEditorDraft(url);
                editing.onChange(url);
                setEditing(null);
              }}
            />
          </div>
        ) : null}
        {editing?.key === 'src' && projectId && editing.picker === 'icon' ? (
          <div className="inspector-text-modal-i18n">
            <IconPicker
              projectId={projectId}
              disabled={disabled || editing?.disabled}
              onPick={(url) => {
                setEditorDraft(url);
                editing.onChange(url);
                setEditing(null);
              }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function boundDataName(raw: string, type: ComponentPropType, variables: PageVariable[] | undefined): string {
  const match = /^\$data\.([\p{ID_Start}$_][\p{ID_Continue}$]*)$/u.exec(raw.trim());
  if (!match) {
    return '';
  }
  const found = (variables ?? []).find((variable) => variable.name === match[1] && variable.type === type);
  return found ? found.name : '';
}

function acceptComponentArg(type: ComponentPropType, raw: string): string | null | false {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  if (type === 'str') {
    return trimmed;
  }
  if (type === 'num') {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? String(parsed) : false;
  }
  if (type === 'bool') {
    const lower = trimmed.toLowerCase();
    if (lower === '1' || lower === 'true') {
      return '1';
    }
    if (lower === '0' || lower === 'false') {
      return '0';
    }
    return false;
  }
  return validateDataLiteral(trimmed, type) ? trimmed : false;
}

export function WidgetPropertyInspector({
  widget,
  parentType,
  disabled,
  onPatch,
  onInvalidChange,
  i18nCatalog,
  projectId,
  ownKeys,
  variables,
  componentProps,
  bindableProps,
}: {
  widget: PageWidget;
  parentType?: PageWidget['type'];
  disabled?: boolean;
  onPatch: (patch: WidgetPatch, coalesceKey: string) => void;
  onInvalidChange?: (invalid: boolean) => void;
  i18nCatalog?: PageI18n;
  projectId?: string;
  ownKeys?: Set<string>;
  variables?: PageVariable[];
  componentProps?: ComponentProp[];
  /** 正在编辑组件时，控件可以双向绑定到这些入参。 */
  bindableProps?: ComponentProp[];
}) {
  const { t } = useTranslation();
  const style = widget.style ?? {};
  const flex = widget.type === 'flex' ? (widget.flex ?? {}) : undefined;
  const swiper = widget.type === 'swiper' ? (widget.swiper ?? {}) : undefined;
  const item =
    parentType === 'flex' &&
    widget.type !== 'swiper-item' &&
    widget.type !== 'th' &&
    widget.type !== 'tr' &&
    widget.type !== 'td'
      ? (widget.item ?? {})
      : undefined;

  function patchStyle(next: Partial<WidgetStyle>) {
    onPatch({ style: sanitizeWidgetStyle(widget.type, { ...style, ...next }) }, `edit:${widget.id}:style`);
  }

  function patchFlex(next: Partial<FlexContainerStyle>) {
    onPatch({ flex: compactFlexContainer({ ...(flex ?? {}), ...next }) }, `edit:${widget.id}:flex`);
  }

  function patchItem(next: Partial<FlexItemStyle>) {
    onPatch({ item: compactFlexItem({ ...(item ?? {}), ...next }) }, `edit:${widget.id}:item`);
  }

  function patchSwiper(next: Partial<SwiperStyle>) {
    onPatch({ swiper: compactSwiper({ ...(swiper ?? {}), ...next }) }, `edit:${widget.id}:swiper`);
  }

  function lengthProp(
    key: string,
    value: BoxLength | string | undefined,
    kind: 'margin' | 'padding' | 'inset',
    write: (next?: BoxLength | string) => void,
  ): InspectorProp {
    return {
      key,
      value: formatLength(value),
      onChange: (raw) => accepted(parseLength(raw, kind), write),
    };
  }

  function lengthBoxProp(
    key: string,
    values: LengthQuad,
    kind: 'margin' | 'padding' | 'inset',
    write: (quad: LengthQuad) => void,
  ): InspectorProp {
    return {
      key,
      value: formatLengthBox(values),
      onChange: (raw) => accepted(parseLengthBox(raw, kind), write),
    };
  }

  function pxProp(key: string, value: number | string | undefined, write: (next?: number | string) => void): InspectorProp {
    return {
      key,
      value: formatPx(value),
      onChange: (raw) => accepted(parsePx(raw), write),
    };
  }

  function modelChoices(type: PageVariable['type']): { value: string; label: string }[] {
    const props = (bindableProps ?? [])
      .filter((prop) => prop.bind && prop.type === type)
      .map((prop) => ({
        value: `$props.${prop.name}`,
        label: prop.desc?.trim() ? `$props.${prop.name} · ${prop.desc.trim()}` : `$props.${prop.name}`,
      }));
    const data = (variables ?? [])
      .filter((variable) => variable.type === type)
      .map((variable) => ({
        value: variable.name,
        label: variable.desc?.trim() ? `${variable.name} · ${variable.desc.trim()}` : variable.name,
      }));
    return [...props, ...data];
  }

  function boundModelStillValid(name: string, type: PageVariable['type']) {
    const prop = propModelName(name);
    if (prop) {
      return (bindableProps ?? []).some((item) => item.bind && item.name === prop && item.type === type);
    }
    return (variables ?? []).some((variable) => variable.name === name && variable.type === type);
  }

  function boxProp(
    key: string,
    values: BoxQuad,
    write: (quad: BoxQuad) => void,
  ): InspectorProp {
    return {
      key,
      value: formatBox(values),
      onChange: (raw) => accepted(parseBox(raw), write),
    };
  }

  const items: InspectorProp[] = [];

  if (widget.type === 'component') {
    const args = widget.args ?? {};
    function writeArg(name: string, value: string | null) {
      const next = { ...args };
      if (value) {
        next[name] = value;
      } else {
        delete next[name];
      }
      onPatch({ args: next }, `edit:${widget.id}:arg:${name}`);
    }
    for (const prop of componentProps ?? []) {
      const stored = args[prop.name] ?? '';
      const dataName = prop.bind ? boundDataName(stored, prop.type, variables) : '';
      const propBound = prop.bind ? propModelName(stored) : '';
      const boundName = dataName || (propBound ? `$props.${propBound}` : '');
      const modelOptions = prop.bind ? modelChoices(prop.type) : [];
      items.push({
        key: `arg.${prop.name}`,
        label: prop.name,
        hint: [prop.type, prop.required ? t('lowcode.propsRequired') : '', prop.desc?.trim() ?? '']
          .filter(Boolean)
          .join(' · '),
        value: boundName || stored,
        category: 'basic',
        placeholder: prop.value,
        disabled: Boolean(boundName),
        copyTools: prop.type === 'str',
        skipTextTools: prop.type !== 'str',
        ...(prop.bind
          ? {
              bind: {
                name: boundName,
                options: modelOptions,
                onChange: (name: string) =>
                  writeArg(prop.name, name ? (name.startsWith('$') ? name : `$data.${name}`) : null),
              },
            }
          : {}),
        onChange: (raw) => {
          if (boundName) {
            return true;
          }
          const next = acceptComponentArg(prop.type, raw);
          if (next === false) {
            return false;
          }
          writeArg(prop.name, next);
          return true;
        },
      });
    }
  }

  if (widget.type === 'image') {
    items.push({
      key: 'src',
      value: widget.src,
      picker: 'image',
      category: 'basic',
      onChange: (raw) => {
        onPatch({ src: raw }, `edit:${widget.id}:src`);
        return true;
      },
    });
  }
  if (widget.type === 'icon') {
    items.push({
      key: 'src',
      value: widget.src,
      picker: 'icon',
      category: 'basic',
      onChange: (raw) => {
        onPatch({ src: raw }, `edit:${widget.id}:src`);
        return true;
      },
    });
    items.push({
      key: 'size',
      value: widget.size != null ? String(widget.size) : '',
      category: 'basic',
      placeholder: '24',
      suffix: 'px',
      onChange: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          onPatch({ size: 0 }, `edit:${widget.id}:size`);
          return true;
        }
        if (isCopyBinding(trimmed)) {
          onPatch({ size: trimmed }, `edit:${widget.id}:size`);
          return true;
        }
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num <= 0) {
          return false;
        }
        onPatch({ size: num }, `edit:${widget.id}:size`);
        return true;
      },
    });
  }
  if (widget.type === 'text') {
    items.push({
      key: 'value',
      value: widget.value,
      category: 'basic',
      onChange: (raw) => {
        onPatch({ value: raw }, `edit:${widget.id}:value`);
        return true;
      },
    });
  }
  if (widget.type === 'input') {
    const modelBound = Boolean(widget.modelValue?.trim());
    const allowed = inputModelDataType(widget.inputType);
    const modelOptions = modelChoices(allowed);
    const boundName = widget.modelValue?.trim() ?? '';
    items.push({
      key: 'value',
      value: modelBound ? boundName : widget.value,
      category: 'basic',
      disabled: modelBound,
      bind: {
        name: boundName,
        options: modelOptions,
        onChange: (name) => {
          onPatch({ modelValue: name.trim() }, `edit:${widget.id}:modelValue`);
        },
      },
      onChange: (raw) => {
        if (modelBound) {
          return true;
        }
        onPatch({ value: raw }, `edit:${widget.id}:value`);
        return true;
      },
    });
    items.push({
      key: 'placeholder',
      value: widget.placeholder ?? '',
      category: 'basic',
      onChange: (raw) => {
        onPatch({ placeholder: raw }, `edit:${widget.id}:placeholder`);
        return true;
      },
    });
    items.push({
      key: 'type',
      value: widget.inputType && widget.inputType !== 'text' ? widget.inputType : '',
      category: 'basic',
      placeholder: 'text',
      onChange: (raw) => {
        const trimmed = raw.trim();
        const inputType = !trimmed || trimmed === 'text' ? 'text' : parseEnum(trimmed, INPUT_TYPES);
        if (inputType === false) {
          return false;
        }
        const allowed = inputModelDataType(inputType);
        const currentName = widget.modelValue?.trim() ?? '';
        const modelValue = boundModelStillValid(currentName, allowed) ? currentName : '';
        onPatch({ inputType, modelValue }, `edit:${widget.id}:type`);
        return true;
      },
    });
  }
  if (widget.type === 'switch') {
    const boundName = widget.modelValue?.trim() ?? '';
    const modelBound = Boolean(boundName);
    const modelOptions = modelChoices('bool');
    items.push({
      key: 'value',
      value: modelBound ? boundName : typeof widget.value === 'string' ? widget.value : widget.value ? 'true' : 'false',
      category: 'basic',
      disabled: modelBound,
      skipTextTools: true,
      bind: {
        name: boundName,
        options: modelOptions,
        onChange: (name) => {
          onPatch({ modelValue: name.trim() }, `edit:${widget.id}:modelValue`);
        },
      },
      onChange: (raw) => {
        if (modelBound) {
          return true;
        }
        if (isCopyBinding(raw.trim())) {
          onPatch({ value: raw.trim() }, `edit:${widget.id}:value`);
          return true;
        }
        const trimmed = raw.trim().toLowerCase();
        if (trimmed !== 'true' && trimmed !== 'false' && trimmed !== '1' && trimmed !== '0' && trimmed !== '') {
          return false;
        }
        onPatch({ value: trimmed === 'true' || trimmed === '1' ? 'true' : 'false' }, `edit:${widget.id}:value`);
        return true;
      },
    });
  }
  if (widget.type === 'button') {
    items.push({
      key: 'text',
      value: widget.text,
      category: 'basic',
      onChange: (raw) => {
        onPatch({ text: raw }, `edit:${widget.id}:text`);
        return true;
      },
    });
  }
  if (widget.type === 'checkbox') {
    const selectedBound = Boolean(widget.selected?.trim());
    const selectedOptions = modelChoices('arr');
    items.push({
      key: 'label',
      value: widget.text,
      category: 'basic',
      onChange: (raw) => {
        onPatch({ text: raw }, `edit:${widget.id}:text`);
        return true;
      },
    });
    items.push({
      key: 'value',
      value: widget.value ?? '',
      category: 'basic',
      onChange: (raw) => {
        onPatch({ value: raw }, `edit:${widget.id}:value`);
        return true;
      },
    });
    items.push({
      key: 'checked',
      value: typeof widget.checked === 'string' ? widget.checked : widget.checked ? 'true' : 'false',
      category: 'basic',
      disabled: selectedBound,
      onChange: (raw) => {
        if (selectedBound) {
          return true;
        }
        if (isCopyBinding(raw.trim())) {
          onPatch({ checked: raw.trim() }, `edit:${widget.id}:checked`);
          return true;
        }
        const trimmed = raw.trim().toLowerCase();
        if (trimmed !== 'true' && trimmed !== 'false' && trimmed !== '1' && trimmed !== '0' && trimmed !== '') {
          return false;
        }
        onPatch({ checked: trimmed === 'true' || trimmed === '1' }, `edit:${widget.id}:checked`);
        return true;
      },
    });
    items.push({
      key: 'selected',
      value: widget.selected ?? '',
      category: 'basic',
      picker: 'model',
      placeholder: t('lowcode.modelValuePick'),
      options: selectedOptions,
      onChange: (raw) => {
        onPatch({ selected: raw.trim() }, `edit:${widget.id}:selected`);
        return true;
      },
    });
  }

  if (widget.type !== 'swiper-item') {
    if (widget.type !== 'icon') items.push(
      {
        key: 'width',
        value: formatSize(style.width) || (widget.type === 'swiper' ? formatSize(DEFAULT_SWIPER_WIDTH) : ''),
        onChange: (raw) => {
          if (widget.type === 'swiper') {
            const parsed = parseSize(raw);
            if (parsed === false || parsed == null) {
              return false;
            }
            return accepted(parsed, (width) => patchStyle({ width }));
          }
          return accepted(parseSize(raw), (width) => patchStyle({ width }));
        },
      },
      {
        key: 'height',
        value: formatSize(style.height) || (widget.type === 'swiper' ? formatSize(DEFAULT_SWIPER_HEIGHT) : ''),
        onChange: (raw) => {
          if (widget.type === 'swiper') {
            const parsed = parseSize(raw);
            if (parsed === false || parsed == null) {
              return false;
            }
            return accepted(parsed, (height) => patchStyle({ height }));
          }
          return accepted(parseSize(raw), (height) => patchStyle({ height }));
        },
      },
    );
    items.push(
      {
        key: 'position',
        value: style.position ?? '',
        onChange: (raw) => {
          const trimmed = raw.trim();
          if (!trimmed || trimmed === 'static') {
            patchStyle({ position: undefined });
            return true;
          }
          return accepted(parseEnum(raw, ['relative', 'absolute', 'fixed', 'sticky'] as const), (position) =>
            patchStyle({ position }),
          );
        },
      },
    );
    if (widget.type === 'text' || widget.type === 'input' || widget.type === 'flex') {
      items.push({
        key: 'overflow',
        value: style.overflow ?? '',
        onChange: (raw) => {
          const trimmed = raw.trim();
          if (!trimmed) {
            patchStyle({ overflow: undefined });
            return true;
          }
          return accepted(parseEnum(raw, OVERFLOW_MODES), (overflow) => patchStyle({ overflow }));
        },
      });
    }
    if (style.position) {
      items.push(
        lengthBoxProp(
          'inset',
          { top: style.top, right: style.right, bottom: style.bottom, left: style.left },
          'inset',
          (quad) =>
            patchStyle({
              top: quad.top,
              right: quad.right,
              bottom: quad.bottom,
              left: quad.left,
            }),
        ),
        lengthProp('top', style.top, 'inset', (top) => patchStyle({ top })),
        lengthProp('right', style.right, 'inset', (right) => patchStyle({ right })),
        lengthProp('bottom', style.bottom, 'inset', (bottom) => patchStyle({ bottom })),
        lengthProp('left', style.left, 'inset', (left) => patchStyle({ left })),
        {
          key: 'zIndex',
          value: style.zIndex == null ? '' : String(style.zIndex),
          onChange: (raw) => {
            const trimmed = raw.trim();
            if (!trimmed) {
              patchStyle({ zIndex: undefined });
              return true;
            }
            return accepted(parseNumber(trimmed), (zIndex) => patchStyle({ zIndex }));
          },
        },
      );
    }
  }

  function rotateProp(
    key: 'rotate-x' | 'rotate-y' | 'rotate-z',
    value: AngleValue | string | undefined,
    patch: (next: AngleValue | string | undefined) => void,
  ): InspectorProp {
    return {
      key,
      value: value ? formatAngle(value) : '',
      onChange: (raw) => accepted(parseRotateInput(raw), patch),
    };
  }

  items.push(
    rotateProp('rotate-x', style.rotateX, (rotateX) => patchStyle({ rotateX })),
    rotateProp('rotate-y', style.rotateY, (rotateY) => patchStyle({ rotateY })),
    rotateProp('rotate-z', style.rotateZ, (rotateZ) => patchStyle({ rotateZ })),
  );

  items.push(
    {
      key: 'backgroundColor',
      value: style.background ?? '',
      onChange: (raw) => accepted(parseCssColor(raw), (background) => patchStyle({ background })),
    },
      {
        key: 'color',
        value: style.color ?? '',
        onChange: (raw) => accepted(parseCssColor(raw), (color) => patchStyle({ color })),
      },
      {
        key: 'fontFamily',
        value: style.fontFamily ?? '',
        onChange: (raw) => accepted(parseFontFamily(raw), (fontFamily) => patchStyle({ fontFamily })),
      },
      {
        key: 'fontSize',
        value: formatPx(style.fontSize),
        onChange: (raw) => accepted(parseFontSize(raw), (fontSize) => patchStyle({ fontSize })),
      },
    {
      key: 'fontWeight',
      value: style.fontWeight ?? '',
      onChange: (raw) => accepted(parseFontWeight(raw), (fontWeight) => patchStyle({ fontWeight })),
    },
    {
      key: 'fontStyle',
      value: formatFontStyle(style.italic),
      onChange: (raw) => accepted(parseFontStyle(raw), (italic) => patchStyle({ italic })),
    },
    {
      key: 'textDecoration',
      value: formatTextDecoration(style),
      onChange: (raw) => accepted(parseTextDecoration(raw), (next) => patchStyle(next)),
    },
    {
      key: 'textShadow',
      value: style.textShadow ?? '',
      onChange: (raw) =>
        accepted(parseCssShadow(raw, 'text-shadow'), (textShadow) => patchStyle({ textShadow })),
    },
    {
      key: 'boxShadow',
      value: style.boxShadow ?? '',
      onChange: (raw) =>
        accepted(parseCssShadow(raw, 'box-shadow'), (boxShadow) => patchStyle({ boxShadow })),
    },
  );

  if (widget.type !== 'swiper-item') {
    items.push(
    lengthBoxProp(
      'margin',
      { top: style.marginTop, right: style.marginRight, bottom: style.marginBottom, left: style.marginLeft },
      'margin',
      (quad) =>
        patchStyle({
          marginTop: quad.top,
          marginRight: quad.right,
          marginBottom: quad.bottom,
          marginLeft: quad.left,
        }),
    ),
    lengthProp('marginTop', style.marginTop, 'margin', (marginTop) => patchStyle({ marginTop })),
    lengthProp('marginRight', style.marginRight, 'margin', (marginRight) => patchStyle({ marginRight })),
    lengthProp('marginBottom', style.marginBottom, 'margin', (marginBottom) => patchStyle({ marginBottom })),
    lengthProp('marginLeft', style.marginLeft, 'margin', (marginLeft) => patchStyle({ marginLeft })),
    );
  }

  if (widget.type !== 'swiper') {
    items.push(
    lengthBoxProp(
      'padding',
      { top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft },
      'padding',
      (quad) =>
        patchStyle({
          paddingTop: quad.top,
          paddingRight: quad.right,
          paddingBottom: quad.bottom,
          paddingLeft: quad.left,
        }),
    ),
    lengthProp('paddingTop', style.paddingTop, 'padding', (paddingTop) => patchStyle({ paddingTop })),
    lengthProp('paddingRight', style.paddingRight, 'padding', (paddingRight) => patchStyle({ paddingRight })),
    lengthProp('paddingBottom', style.paddingBottom, 'padding', (paddingBottom) => patchStyle({ paddingBottom })),
    lengthProp('paddingLeft', style.paddingLeft, 'padding', (paddingLeft) => patchStyle({ paddingLeft })),
    );
  }

  if (widget.type !== 'swiper-item' && widget.type !== 'th' && widget.type !== 'tr' && widget.type !== 'td') {
  items.push(
    {
      key: 'borderTopColor',
      value: style.borderTopColor ?? style.borderColor ?? '',
      onChange: (raw) => accepted(parseCssColor(raw), (borderTopColor) => patchStyle({ borderTopColor })),
    },
    {
      key: 'borderRightColor',
      value: style.borderRightColor ?? style.borderColor ?? '',
      onChange: (raw) => accepted(parseCssColor(raw), (borderRightColor) => patchStyle({ borderRightColor })),
    },
    {
      key: 'borderBottomColor',
      value: style.borderBottomColor ?? style.borderColor ?? '',
      onChange: (raw) => accepted(parseCssColor(raw), (borderBottomColor) => patchStyle({ borderBottomColor })),
    },
    {
      key: 'borderLeftColor',
      value: style.borderLeftColor ?? style.borderColor ?? '',
      onChange: (raw) => accepted(parseCssColor(raw), (borderLeftColor) => patchStyle({ borderLeftColor })),
    },
    {
      key: 'borderTopStyle',
      value: style.borderTopStyle ?? style.borderStyle ?? '',
      onChange: (raw) => accepted(parseBorderStyle(raw), (borderTopStyle) => patchStyle({ borderTopStyle })),
    },
    {
      key: 'borderRightStyle',
      value: style.borderRightStyle ?? style.borderStyle ?? '',
      onChange: (raw) => accepted(parseBorderStyle(raw), (borderRightStyle) => patchStyle({ borderRightStyle })),
    },
    {
      key: 'borderBottomStyle',
      value: style.borderBottomStyle ?? style.borderStyle ?? '',
      onChange: (raw) => accepted(parseBorderStyle(raw), (borderBottomStyle) => patchStyle({ borderBottomStyle })),
    },
    {
      key: 'borderLeftStyle',
      value: style.borderLeftStyle ?? style.borderStyle ?? '',
      onChange: (raw) => accepted(parseBorderStyle(raw), (borderLeftStyle) => patchStyle({ borderLeftStyle })),
    },
    boxProp(
      'borderWidth',
      {
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth,
      },
      (quad) =>
        patchStyle({
          borderTopWidth: quad.top,
          borderRightWidth: quad.right,
          borderBottomWidth: quad.bottom,
          borderLeftWidth: quad.left,
          borderTopStyle: quad.top ? style.borderTopStyle || style.borderStyle || 'solid' : style.borderTopStyle,
          borderRightStyle: quad.right ? style.borderRightStyle || style.borderStyle || 'solid' : style.borderRightStyle,
          borderBottomStyle: quad.bottom ? style.borderBottomStyle || style.borderStyle || 'solid' : style.borderBottomStyle,
          borderLeftStyle: quad.left ? style.borderLeftStyle || style.borderStyle || 'solid' : style.borderLeftStyle,
        }),
    ),
    pxProp('borderTopWidth', style.borderTopWidth, (borderTopWidth) => patchStyle({ borderTopWidth })),
    pxProp('borderRightWidth', style.borderRightWidth, (borderRightWidth) => patchStyle({ borderRightWidth })),
    pxProp('borderBottomWidth', style.borderBottomWidth, (borderBottomWidth) => patchStyle({ borderBottomWidth })),
    pxProp('borderLeftWidth', style.borderLeftWidth, (borderLeftWidth) => patchStyle({ borderLeftWidth })),
  );
  }

  if (widget.type !== 'swiper-item') {
  items.push(
    boxProp(
      'borderRadius',
      {
        top: style.radiusTopLeft,
        right: style.radiusTopRight,
        bottom: style.radiusBottomRight,
        left: style.radiusBottomLeft,
      },
      (quad) =>
        patchStyle({
          radiusTopLeft: quad.top,
          radiusTopRight: quad.right,
          radiusBottomRight: quad.bottom,
          radiusBottomLeft: quad.left,
        }),
    ),
    pxProp('borderTopLeftRadius', style.radiusTopLeft, (radiusTopLeft) => patchStyle({ radiusTopLeft })),
    pxProp('borderTopRightRadius', style.radiusTopRight, (radiusTopRight) => patchStyle({ radiusTopRight })),
    pxProp('borderBottomRightRadius', style.radiusBottomRight, (radiusBottomRight) =>
      patchStyle({ radiusBottomRight }),
    ),
    pxProp('borderBottomLeftRadius', style.radiusBottomLeft, (radiusBottomLeft) =>
      patchStyle({ radiusBottomLeft }),
    ),
  );
  }

  if (flex) {
    items.push(
      {
        key: 'display',
        value: flex.display ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexDisplay>(raw, FLEX_DISPLAYS), (display) => patchFlex({ display })),
      },
      {
        key: 'flexDirection',
        value: flex.flexDirection ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexDirection>(raw, FLEX_DIRECTIONS), (flexDirection) => patchFlex({ flexDirection })),
      },
      {
        key: 'flexWrap',
        value: flex.flexWrap ?? '',
        onChange: (raw) => accepted(parseEnum<FlexWrap>(raw, FLEX_WRAPS), (flexWrap) => patchFlex({ flexWrap })),
      },
      {
        key: 'justifyContent',
        value: flex.justifyContent ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexJustifyContent>(raw, FLEX_JUSTIFY_CONTENTS), (justifyContent) =>
            patchFlex({ justifyContent }),
          ),
      },
      {
        key: 'alignItems',
        value: flex.alignItems ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexAlignItems>(raw, FLEX_ALIGN_ITEMS), (alignItems) => patchFlex({ alignItems })),
      },
      {
        key: 'alignContent',
        value: flex.alignContent ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexAlignContent>(raw, FLEX_ALIGN_CONTENTS), (alignContent) =>
            patchFlex({ alignContent }),
          ),
      },
      {
        key: 'gap',
        value:
          flex.rowGap == null || flex.columnGap == null
            ? ''
            : flex.rowGap === flex.columnGap
              ? formatPx(flex.rowGap)
              : `${formatPx(flex.rowGap)} ${formatPx(flex.columnGap)}`,
        onChange: (raw) =>
          accepted(parseBox(raw), (quad) => patchFlex({ rowGap: quad.top, columnGap: quad.right })),
      },
      pxProp('rowGap', flex.rowGap, (rowGap) => patchFlex({ rowGap })),
      pxProp('columnGap', flex.columnGap, (columnGap) => patchFlex({ columnGap })),
    );
  }

  if (item) {
    items.push(
      {
        key: 'order',
        value: item.order == null ? '' : String(item.order),
        onChange: (raw) => accepted(parseNumber(raw), (order) => patchItem({ order })),
      },
      {
        key: 'flexGrow',
        value: item.flexGrow == null ? '' : String(item.flexGrow),
        onChange: (raw) => accepted(parseNumber(raw, 0), (flexGrow) => patchItem({ flexGrow })),
      },
      {
        key: 'flexShrink',
        value: item.flexShrink == null ? '' : String(item.flexShrink),
        onChange: (raw) => accepted(parseNumber(raw, 0), (flexShrink) => patchItem({ flexShrink })),
      },
      {
        key: 'flexBasis',
        value: formatFlexBasis(item.flexBasis),
        onChange: (raw) => accepted(parseFlexBasis(raw), (flexBasis) => patchItem({ flexBasis })),
      },
      {
        key: 'alignSelf',
        value: item.alignSelf ?? '',
        onChange: (raw) =>
          accepted(parseEnum<FlexAlignSelf>(raw, FLEX_ALIGN_SELFS), (alignSelf) => patchItem({ alignSelf })),
      },
    );
  }

  if (swiper) {
    items.push(
      {
        key: 'indicatorDots',
        value: formatBool(swiper.indicatorDots),
        category: 'basic',
        onChange: (raw) =>
          accepted(parseBool(raw), (indicatorDots) => patchSwiper({ indicatorDots: indicatorDots || undefined })),
      },
      {
        key: 'indicatorColor',
        value: swiper.indicatorColor ?? '',
        category: 'basic',
        onChange: (raw) =>
          accepted(parseCssColor(raw), (indicatorColor) => patchSwiper({ indicatorColor })),
      },
      {
        key: 'indicatorActiveColor',
        value: swiper.indicatorActiveColor ?? '',
        category: 'basic',
        onChange: (raw) =>
          accepted(parseCssColor(raw), (indicatorActiveColor) => patchSwiper({ indicatorActiveColor })),
      },
      {
        key: 'autoplay',
        value: formatBool(swiper.autoplay),
        category: 'basic',
        onChange: (raw) => accepted(parseBool(raw), (autoplay) => patchSwiper({ autoplay: autoplay || undefined })),
      },
      {
        key: 'current',
        value: swiper.current == null ? '' : String(swiper.current),
        category: 'basic',
        onChange: (raw) => accepted(parseNumber(raw, 0), (current) => patchSwiper({ current })),
      },
      {
        key: 'interval',
        value: swiper.interval == null ? '' : String(swiper.interval),
        category: 'basic',
        onChange: (raw) => accepted(parseNumber(raw, 1), (interval) => patchSwiper({ interval })),
      },
      {
        key: 'duration',
        value: swiper.duration == null ? '' : String(swiper.duration),
        category: 'basic',
        onChange: (raw) => accepted(parseNumber(raw, 0), (duration) => patchSwiper({ duration })),
      },
      {
        key: 'circular',
        value: formatBool(swiper.circular),
        category: 'basic',
        onChange: (raw) => accepted(parseBool(raw), (circular) => patchSwiper({ circular: circular || undefined })),
      },
      {
        key: 'vertical',
        value: formatBool(swiper.vertical),
        category: 'basic',
        onChange: (raw) => accepted(parseBool(raw), (vertical) => patchSwiper({ vertical: vertical || undefined })),
      },
      pxProp('previousMargin', swiper.previousMargin, (previousMargin) => patchSwiper({ previousMargin })),
      pxProp('nextMargin', swiper.nextMargin, (nextMargin) => patchSwiper({ nextMargin })),
      {
        key: 'displayMultipleItems',
        value: swiper.displayMultipleItems == null ? '' : String(swiper.displayMultipleItems),
        category: 'basic',
        onChange: (raw) =>
          accepted(parseNumber(raw, 1), (displayMultipleItems) => patchSwiper({ displayMultipleItems })),
      },
      {
        key: 'snapToEdge',
        value: formatBool(swiper.snapToEdge),
        category: 'basic',
        onChange: (raw) =>
          accepted(parseBool(raw), (snapToEdge) => patchSwiper({ snapToEdge: snapToEdge || undefined })),
      },
      {
        key: 'easingFunction',
        value: swiper.easingFunction ?? '',
        category: 'basic',
        onChange: (raw) =>
          accepted(parseEnum<SwiperEasing>(raw, SWIPER_EASINGS), (easingFunction) => patchSwiper({ easingFunction })),
      },
    );
  }

  const markedItems = ownKeys
    ? items.map((item) => ({
        ...item,
        inherited: !ownKeys.has(item.key),
        value: ownKeys.has(item.key) ? item.value : '',
      }))
    : items;

  return (
    <PropertyGrid
      disabled={disabled}
      items={markedItems}
      resetKey={widget.id}
      onInvalidChange={onInvalidChange}
      i18nCatalog={i18nCatalog}
      projectId={projectId}
    />
  );
}

export function PagePropertyInspector({
  style,
  disabled,
  onChange,
  onInvalidChange,
}: {
  style?: PageStyle;
  disabled?: boolean;
  onChange: (style: PageStyle | undefined, field: string) => void;
  onInvalidChange?: (invalid: boolean) => void;
}) {
  const current = style ?? {};

  function patch(next: Partial<PageStyle>, field: string) {
    onChange(compactPageStyle({ ...current, ...next }), field);
  }

  const items: InspectorProp[] = [
    {
      key: 'backgroundColor',
      value: current.background ?? '',
      onChange: (raw) =>
        accepted(parseCssColor(raw), (background) => patch({ background }, 'background')),
    },
    {
      key: 'padding',
      value: formatBox({
        top: current.paddingTop,
        right: current.paddingRight,
        bottom: current.paddingBottom,
        left: current.paddingLeft,
      }),
      onChange: (raw) =>
        accepted(parseBox(raw), (quad) =>
          patch(
            {
              paddingTop: quad.top,
              paddingRight: quad.right,
              paddingBottom: quad.bottom,
              paddingLeft: quad.left,
            },
            'padding',
          ),
        ),
    },
    {
      key: 'paddingTop',
      value: formatPx(current.paddingTop),
      onChange: (raw) => accepted(parsePx(raw), (paddingTop) => patch({ paddingTop }, 'padding')),
    },
    {
      key: 'paddingRight',
      value: formatPx(current.paddingRight),
      onChange: (raw) => accepted(parsePx(raw), (paddingRight) => patch({ paddingRight }, 'padding')),
    },
    {
      key: 'paddingBottom',
      value: formatPx(current.paddingBottom),
      onChange: (raw) => accepted(parsePx(raw), (paddingBottom) => patch({ paddingBottom }, 'padding')),
    },
    {
      key: 'paddingLeft',
      value: formatPx(current.paddingLeft),
      onChange: (raw) => accepted(parsePx(raw), (paddingLeft) => patch({ paddingLeft }, 'padding')),
    },
  ];

  return <PropertyGrid disabled={disabled} items={items} resetKey="page" onInvalidChange={onInvalidChange} />;
}
