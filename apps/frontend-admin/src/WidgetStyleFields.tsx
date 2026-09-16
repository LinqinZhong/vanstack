import { ColorPicker, Form, InputNumber, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compactSize, compactWidgetStyle, type SizeMode, type SizeValue, type WidgetStyle } from '@vanstack/xml';

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
  return value || null;
}

function unifiedRadius(style: WidgetStyle) {
  const corners = [style.radiusTopLeft, style.radiusTopRight, style.radiusBottomRight, style.radiusBottomLeft];
  const first = corners[0];
  if (first == null || corners.some((corner) => corner !== first)) {
    return undefined;
  }
  return first;
}

function unifiedEdges(top?: number, right?: number, bottom?: number, left?: number) {
  if (top == null || top !== right || right !== bottom || bottom !== left) {
    return undefined;
  }
  return top;
}

function SizeField({
  label,
  size,
  disabled,
  onChange,
}: {
  label: string;
  size?: SizeValue;
  disabled?: boolean;
  onChange: (size: SizeValue | undefined) => void;
}) {
  const { t } = useTranslation();
  const mode: SizeMode = size?.mode ?? 'fit-content';
  const numeric = mode === 'fit-content' ? undefined : size?.value;

  return (
    <Form.Item label={label}>
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
            onChange(compactSize({ mode, value: value ?? 0 }));
          }}
        />
        <Select
          size="small"
          disabled={disabled}
          value={mode}
          onChange={(next: SizeMode) => {
            if (next === 'fit-content') {
              onChange(undefined);
              return;
            }
            onChange({ mode: next, value: numeric ?? 100 });
          }}
          options={[
            { value: 'px', label: 'px' },
            { value: '%', label: '%' },
            { value: 'fit-content', label: t('lowcode.styleSizeFit') },
          ]}
        />
      </div>
    </Form.Item>
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
  widgetType: 'text' | 'button' | 'flex';
  style?: WidgetStyle;
  disabled?: boolean;
  onChange: (style: WidgetStyle | undefined) => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};
  const [textShadow, setTextShadow] = useState(() => parseCssShadow(current.textShadow));
  const [boxShadow, setBoxShadow] = useState(() => parseCssShadow(current.boxShadow));

  useEffect(() => {
    setTextShadow(parseCssShadow(style?.textShadow));
    setBoxShadow(parseCssShadow(style?.boxShadow));
  }, [widgetId, style?.textShadow, style?.boxShadow]);

  function patch(next: Partial<WidgetStyle>) {
    onChange(compactWidgetStyle({ ...current, ...next }));
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
      {widgetType !== 'flex' ? (
        <>
      <div className="style-section">{t('lowcode.styleFont')}</div>
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
      <SizeField
        label={t('lowcode.styleWidth')}
        size={current.width}
        disabled={disabled}
        onChange={(width) => patch({ width })}
      />
      <SizeField
        label={t('lowcode.styleHeight')}
        size={current.height}
        disabled={disabled}
        onChange={(height) => patch({ height })}
      />
      <Form.Item label={t('lowcode.styleMargin')}>
        <div className="style-radius-fields">
          <InputNumber
            size="small"
            disabled={disabled}
            value={unifiedEdges(current.marginTop, current.marginRight, current.marginBottom, current.marginLeft)}
            onChange={(value) =>
              patch({
                marginTop: value ?? undefined,
                marginRight: value ?? undefined,
                marginBottom: value ?? undefined,
                marginLeft: value ?? undefined,
              })
            }
            addonAfter="px"
          />
          <div className="style-radius-grid">
            <InputNumber
              size="small"
              disabled={disabled}
              value={current.marginTop}
              onChange={(marginTop) => patch({ marginTop: marginTop ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeTop')}
            />
            <InputNumber
              size="small"
              disabled={disabled}
              value={current.marginRight}
              onChange={(marginRight) => patch({ marginRight: marginRight ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeRight')}
            />
            <InputNumber
              size="small"
              disabled={disabled}
              value={current.marginBottom}
              onChange={(marginBottom) => patch({ marginBottom: marginBottom ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeBottom')}
            />
            <InputNumber
              size="small"
              disabled={disabled}
              value={current.marginLeft}
              onChange={(marginLeft) => patch({ marginLeft: marginLeft ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeLeft')}
            />
          </div>
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.stylePadding')}>
        <div className="style-radius-fields">
          <InputNumber
            size="small"
            min={0}
            disabled={disabled}
            value={unifiedEdges(
              current.paddingTop,
              current.paddingRight,
              current.paddingBottom,
              current.paddingLeft,
            )}
            onChange={(value) =>
              patch({
                paddingTop: value ?? undefined,
                paddingRight: value ?? undefined,
                paddingBottom: value ?? undefined,
                paddingLeft: value ?? undefined,
              })
            }
            addonAfter="px"
          />
          <div className="style-radius-grid">
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingTop}
              onChange={(paddingTop) => patch({ paddingTop: paddingTop ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeTop')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingRight}
              onChange={(paddingRight) => patch({ paddingRight: paddingRight ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeRight')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingBottom}
              onChange={(paddingBottom) => patch({ paddingBottom: paddingBottom ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeBottom')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingLeft}
              onChange={(paddingLeft) => patch({ paddingLeft: paddingLeft ?? undefined })}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeLeft')}
            />
          </div>
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.styleBackground')}>
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
      <Form.Item label={t('lowcode.styleBorder')}>
        <div className="style-border-row">
          <InputNumber
            size="small"
            min={0}
            max={20}
            disabled={disabled}
            value={current.borderWidth}
            onChange={(borderWidth) =>
              patch({
                borderWidth: borderWidth ?? undefined,
                borderStyle: borderWidth ? current.borderStyle || 'solid' : current.borderStyle,
              })
            }
            addonAfter="px"
          />
          <Select
            size="small"
            allowClear
            disabled={disabled}
            value={current.borderStyle}
            placeholder={t('lowcode.styleBorderNone')}
            onChange={(borderStyle) => patch({ borderStyle: borderStyle || undefined })}
            options={[
              { value: 'solid', label: t('lowcode.styleBorderSolid') },
              { value: 'dashed', label: t('lowcode.styleBorderDashed') },
              { value: 'dotted', label: t('lowcode.styleBorderDotted') },
            ]}
          />
          <ColorPicker
            size="small"
            allowClear
            disabled={disabled}
            value={colorValue(current.borderColor)}
            onChange={(value, css) => patch({ borderColor: value.cleared ? undefined : css })}
          />
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.styleBorderRadius')}>
        <div className="style-radius-fields">
          <InputNumber
            size="small"
            min={0}
            max={999}
            disabled={disabled}
            value={unifiedRadius(current)}
            onChange={(value) =>
              patch({
                radiusTopLeft: value ?? undefined,
                radiusTopRight: value ?? undefined,
                radiusBottomRight: value ?? undefined,
                radiusBottomLeft: value ?? undefined,
              })
            }
            addonAfter="px"
          />
          <div className="style-radius-grid">
            <InputNumber
              size="small"
              min={0}
              max={999}
              disabled={disabled}
              value={current.radiusTopLeft}
              onChange={(radiusTopLeft) => patch({ radiusTopLeft: radiusTopLeft ?? undefined })}
              addonAfter="px"
            />
            <InputNumber
              size="small"
              min={0}
              max={999}
              disabled={disabled}
              value={current.radiusTopRight}
              onChange={(radiusTopRight) => patch({ radiusTopRight: radiusTopRight ?? undefined })}
              addonAfter="px"
            />
            <InputNumber
              size="small"
              min={0}
              max={999}
              disabled={disabled}
              value={current.radiusBottomLeft}
              onChange={(radiusBottomLeft) => patch({ radiusBottomLeft: radiusBottomLeft ?? undefined })}
              addonAfter="px"
            />
            <InputNumber
              size="small"
              min={0}
              max={999}
              disabled={disabled}
              value={current.radiusBottomRight}
              onChange={(radiusBottomRight) => patch({ radiusBottomRight: radiusBottomRight ?? undefined })}
              addonAfter="px"
            />
          </div>
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.styleBoxShadow')}>
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
    </>
  );
}
