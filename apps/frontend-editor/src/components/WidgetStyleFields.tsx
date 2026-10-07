import { ColorPicker, Form, InputNumber, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compactSize, convertAngle, compactAngle, DEFAULT_SCROLL_HEIGHT, DEFAULT_SCROLL_WIDTH, DEFAULT_SWIPER_HEIGHT, DEFAULT_SWIPER_WIDTH, isCopyBinding, sanitizeWidgetStyle, ANGLE_UNITS, type AngleUnit, type AngleValue, type PageWidget, type SizeMode, type SizeValue, type WidgetStyle } from '@vanstack/xml';
import { StyleBoxEdges, pxFromLength } from './StyleBoxEdges';

type ShadowValue = {
  x: number;
  y: number;
  blur: number;
  color: string;
};

const DEFAULT_SHADOW: ShadowValue = { x: 0, y: 0, blur: 4, color: '' };

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

export const FONT_FAMILY_OPTIONS = [
  { value: '"Microsoft YaHei", "微软雅黑", sans-serif', zh: '微软雅黑', en: 'Microsoft YaHei' },
  { value: 'SimSun, "宋体", serif', zh: '宋体', en: 'SimSun' },
  { value: 'SimHei, "黑体", sans-serif', zh: '黑体', en: 'SimHei' },
  { value: 'KaiTi, "楷体", serif', zh: '楷体', en: 'KaiTi' },
  { value: 'FangSong, "仿宋", serif', zh: '仿宋', en: 'FangSong' },
  { value: 'Arial, sans-serif', zh: 'Arial', en: 'Arial' },
  { value: '"Times New Roman", serif', zh: 'Times New Roman', en: 'Times New Roman' },
] as const;

export function fontFamilyOptions(locale: string) {
  const zh = locale.toLowerCase().startsWith('zh');
  return FONT_FAMILY_OPTIONS.map((item) => ({
    value: item.value,
    label: zh ? item.zh : item.en,
  }));
}

export function SizeField({
  label,
  size,
  disabled,
  allowFit = true,
  fallback,
  onChange,
}: {
  label: string;
  size?: SizeValue | string;
  disabled?: boolean;
  allowFit?: boolean;
  fallback?: SizeValue;
  onChange: (size: SizeValue | string | undefined) => void;
}) {
  const { t } = useTranslation();
  const concrete = typeof size === 'object' ? size : undefined;
  const fallbackMode: SizeMode = fallback?.mode === '%' ? '%' : 'px';
  const mode: SizeMode = allowFit ? (concrete?.mode ?? 'fit-content') : (concrete?.mode ?? fallbackMode);
  const numeric = mode === 'fit-content' ? undefined : (concrete?.value ?? fallback?.value);

  return (
    <Form.Item className="inspector-pair" label={label}>
      <div className="style-size-row">
        <InputNumber
          size="small"
          min={0}
          disabled={disabled || mode === 'fit-content'}
          value={numeric}
          onChange={(value) => {
            if (mode === 'fit-content') {
              return;
            }
            onChange(compactSize({ mode, value: value ?? fallback?.value ?? 0 }));
          }}
        />
        <Select
          size="small"
          disabled={disabled}
          value={mode === 'fit-content' ? 'fit-content' : mode}
          popupMatchSelectWidth={false}
          getPopupContainer={() => document.body}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(next: SizeMode) => {
            if (next === 'fit-content') {
              if (!allowFit) {
                return;
              }
              onChange(undefined);
              return;
            }
            onChange({ mode: next, value: numeric ?? fallback?.value ?? 100 });
          }}
          options={[
            { value: 'px', label: 'px' },
            { value: '%', label: '%' },
            ...(allowFit ? [{ value: 'fit-content' as const, label: t('lowcode.styleSizeFit') }] : []),
          ]}
        />
      </div>
    </Form.Item>
  );
}

export function AngleField({
  label,
  angle,
  disabled,
  popupContainer,
  onChange,
}: {
  label: string;
  angle?: AngleValue | string;
  disabled?: boolean;
  popupContainer?: () => HTMLElement;
  onChange: (angle: AngleValue | string | undefined) => void;
}) {
  const concrete = typeof angle === 'object' ? angle : undefined;
  const unit: AngleUnit = concrete?.unit ?? 'deg';
  const numeric = concrete?.value;
  return (
    <div className="style-box-row">
      <span className="style-box-row-label">{label}</span>
      <InputNumber
        size="small"
        disabled={disabled}
        value={numeric}
        step={unit === 'rad' || unit === 'turn' ? 0.01 : 1}
        onChange={(value) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            onChange(undefined);
            return;
          }
          onChange(compactAngle({ value, unit }));
        }}
      />
      <Select
        size="small"
        disabled={disabled}
        value={unit}
        popupMatchSelectWidth={false}
        getPopupContainer={popupContainer ?? (() => document.body)}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(next: AngleUnit) => {
          if (concrete) {
            onChange(compactAngle(convertAngle(concrete, next)));
            return;
          }
          onChange(undefined);
        }}
        options={ANGLE_UNITS.map((value) => ({ value, label: value }))}
      />
    </div>
  );
}

const DEFAULT_BUTTON_BACKGROUND = '#ffffff';

export function WidgetStyleFields({
  widgetId,
  widgetType,
  style,
  disabled,
  onChange,
}: {
  widgetId: string;
  widgetType: PageWidget['type'];
  style?: WidgetStyle;
  disabled?: boolean;
  onChange: (style: WidgetStyle | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const current = style ?? {};
  const frameLocked = widgetType === 'windows' || widgetType === 'window';
  const [textShadow, setTextShadow] = useState(() => parseCssShadow(current.textShadow));
  const [boxShadow, setBoxShadow] = useState(() => parseCssShadow(current.boxShadow));

  useEffect(() => {
    setTextShadow(parseCssShadow(style?.textShadow));
    setBoxShadow(parseCssShadow(style?.boxShadow));
  }, [widgetId, style?.textShadow, style?.boxShadow]);

  function patch(next: Partial<WidgetStyle>) {
    onChange(sanitizeWidgetStyle(widgetType, { ...current, ...next }));
  }

  function patchTextShadow(next: Partial<ShadowValue>) {
    const shadow = { ...textShadow, ...next };
    setTextShadow(shadow);
    patch({ textShadow: formatCssShadow(shadow) });
  }

  function patchBoxShadow(next: Partial<ShadowValue>) {
    const shadow = { ...boxShadow, ...next };
    setBoxShadow(shadow);
    patch({ boxShadow: formatCssShadow(shadow) });
  }

  return (
    <>
      {widgetType === 'text' || widgetType === 'button' || widgetType === 'checkbox' || widgetType === 'input' ? (
        <>
      <div className="style-section">{t('lowcode.styleFont')}</div>
      <Form.Item className="inspector-pair" label={t('lowcode.styleFontFamily')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.fontFamily}
          placeholder={t('lowcode.styleFontDefault')}
          options={fontFamilyOptions(i18n.language)}
          onChange={(fontFamily) => patch({ fontFamily: fontFamily || undefined })}
        />
      </Form.Item>
      <Form.Item className="inspector-pair" label={t('lowcode.styleFontSize')}>
        <InputNumber
          size="small"
          min={1}
          max={999}
          controls
          disabled={disabled}
          value={current.fontSize}
          suffix="px"
          onChange={(fontSize) => patch({ fontSize: fontSize ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleColor')}>
        <ColorPicker
          size="small"
          allowClear
          disabled={disabled}
          value={colorValue(current.color)}
          onChange={(value, css) => patch({ color: value.cleared ? undefined : css })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleTextShadow')}>
        <div className="style-shadow-row">
          <InputNumber
            size="small"
            disabled={disabled}
            value={textShadow.x}
            onChange={(value) => patchTextShadow({ x: value ?? 0 })}
            placeholder="X"
          />
          <InputNumber
            size="small"
            disabled={disabled}
            value={textShadow.y}
            onChange={(value) => patchTextShadow({ y: value ?? 0 })}
            placeholder="Y"
          />
          <InputNumber
            size="small"
            min={0}
            disabled={disabled}
            value={textShadow.blur}
            onChange={(value) => patchTextShadow({ blur: value ?? 0 })}
            placeholder={t('lowcode.styleShadowBlur')}
          />
          <ColorPicker
            size="small"
            allowClear
            disabled={disabled}
            value={colorValue(textShadow.color)}
            onChange={(value, css) => patchTextShadow({ color: value.cleared ? '' : css })}
          />
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.styleItalic')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.italic)}
          onChange={(italic) => patch({ italic })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleFontWeight')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.fontWeight}
          placeholder={t('lowcode.styleWeightNormal')}
          onChange={(fontWeight) => patch({ fontWeight: fontWeight || undefined })}
          options={[
            { value: '400', label: t('lowcode.styleWeightNormal') },
            { value: '500', label: t('lowcode.styleWeightMedium') },
            { value: '600', label: t('lowcode.styleWeightSemibold') },
            { value: '700', label: t('lowcode.styleWeightBold') },
          ]}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleUnderline')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.underline)}
          onChange={(underline) => patch({ underline })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleLineThrough')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.lineThrough)}
          onChange={(lineThrough) => patch({ lineThrough })}
        />
      </Form.Item>
        </>
      ) : null}

      <div className="style-section">{t('lowcode.styleBox')}</div>
      {widgetType !== 'swiper-item' && !frameLocked ? (
        <>
          <SizeField
            label={t('lowcode.styleWidth')}
            size={current.width}
            disabled={disabled}
            allowFit={widgetType !== 'swiper' && widgetType !== 'scroll'}
            fallback={
              widgetType === 'swiper' ? DEFAULT_SWIPER_WIDTH : widgetType === 'scroll' ? DEFAULT_SCROLL_WIDTH : undefined
            }
            onChange={(width) => patch({ width })}
          />
          <SizeField
            label={t('lowcode.styleHeight')}
            size={current.height}
            disabled={disabled}
            allowFit={widgetType !== 'swiper' && widgetType !== 'scroll'}
            fallback={
              widgetType === 'swiper'
                ? DEFAULT_SWIPER_HEIGHT
                : widgetType === 'scroll'
                  ? DEFAULT_SCROLL_HEIGHT
                  : undefined
            }
            onChange={(height) => patch({ height })}
          />
        </>
      ) : null}
      <Form.Item className="inspector-pair" label={t('lowcode.styleBackground')}>
        <ColorPicker
          size="small"
          allowClear={widgetType !== 'button'}
          disabled={disabled}
          value={colorValue(
            current.background || (widgetType === 'button' ? DEFAULT_BUTTON_BACKGROUND : undefined),
          )}
          onChange={(value, css) =>
            patch({
              background:
                value.cleared && widgetType === 'button'
                  ? DEFAULT_BUTTON_BACKGROUND
                  : value.cleared
                    ? undefined
                    : css,
            })
          }
        />
      </Form.Item>
      <Form.Item className="inspector-pair" label={t('lowcode.styleBoxShadow')}>
        <div className="style-shadow-row">
          <InputNumber
            size="small"
            disabled={disabled}
            value={boxShadow.x}
            onChange={(value) => patchBoxShadow({ x: value ?? 0 })}
            placeholder="X"
          />
          <InputNumber
            size="small"
            disabled={disabled}
            value={boxShadow.y}
            onChange={(value) => patchBoxShadow({ y: value ?? 0 })}
            placeholder="Y"
          />
          <InputNumber
            size="small"
            min={0}
            disabled={disabled}
            value={boxShadow.blur}
            onChange={(value) => patchBoxShadow({ blur: value ?? 0 })}
            placeholder={t('lowcode.styleShadowBlur')}
          />
          <ColorPicker
            size="small"
            allowClear
            disabled={disabled}
            value={colorValue(boxShadow.color)}
            onChange={(value, css) => patchBoxShadow({ color: value.cleared ? '' : css })}
          />
        </div>
      </Form.Item>
      {widgetType !== 'swiper-item' && !frameLocked ? (
      <Form.Item label={t('lowcode.styleMargin')}>
        <StyleBoxEdges
          resetKey={widgetId}
          disabled={disabled}
          units={['px', '%', 'auto']}
          lengthKind="margin"
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
      </Form.Item>
      ) : null}
      {widgetType !== 'swiper' && !frameLocked ? (
      <Form.Item label={t('lowcode.stylePadding')}>
        <StyleBoxEdges
          resetKey={widgetId}
          disabled={disabled}
          min={0}
          units={['px', '%']}
          lengthKind="padding"
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
      </Form.Item>
      ) : null}
      {widgetType !== 'swiper-item' && !frameLocked ? (
      <>
      <Form.Item label={t('lowcode.styleBorder')}>
        <div className="style-border-fields">
          <StyleBoxEdges
            resetKey={widgetId}
            disabled={disabled}
            min={0}
            max={20}
            stroke={{ color: current.borderTopColor ?? current.borderColor, style: current.borderTopStyle ?? current.borderStyle }}
            values={{
              top: current.borderTopWidth,
              right: current.borderRightWidth,
              bottom: current.borderBottomWidth,
              left: current.borderLeftWidth,
            }}
            lines={{
              style: {
                top: current.borderTopStyle ?? current.borderStyle,
                right: current.borderRightStyle ?? current.borderStyle,
                bottom: current.borderBottomStyle ?? current.borderStyle,
                left: current.borderLeftStyle ?? current.borderStyle,
              },
              color: {
                top: current.borderTopColor ?? current.borderColor,
                right: current.borderRightColor ?? current.borderColor,
                bottom: current.borderBottomColor ?? current.borderColor,
                left: current.borderLeftColor ?? current.borderColor,
              },
            }}
            onLineChange={(lines) => {
              patch({
                borderTopStyle: lines.style.top,
                borderRightStyle: lines.style.right,
                borderBottomStyle: lines.style.bottom,
                borderLeftStyle: lines.style.left,
                borderTopColor: lines.color.top,
                borderRightColor: lines.color.right,
                borderBottomColor: lines.color.bottom,
                borderLeftColor: lines.color.left,
                borderTopWidth: lines.style.top || lines.color.top ? current.borderTopWidth ?? 1 : current.borderTopWidth,
                borderRightWidth: lines.style.right || lines.color.right ? current.borderRightWidth ?? 1 : current.borderRightWidth,
                borderBottomWidth: lines.style.bottom || lines.color.bottom ? current.borderBottomWidth ?? 1 : current.borderBottomWidth,
                borderLeftWidth: lines.style.left || lines.color.left ? current.borderLeftWidth ?? 1 : current.borderLeftWidth,
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
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.styleBorderRadius')}>
        <StyleBoxEdges
          resetKey={widgetId}
          kind="corners"
          disabled={disabled}
          min={0}
          max={999}
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
      </Form.Item>
      </>
      ) : null}
    </>
  );
}
