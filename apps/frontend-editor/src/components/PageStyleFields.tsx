import { ColorPicker, Form, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { compactPageStyle, OVERFLOW_MODES, type OverflowMode, type PageStyle } from '@vanstack/xml';

function pageNumber(value?: number | string) {
  return typeof value === 'number' ? value : null;
}

function unifiedEdges(top?: number | string, right?: number | string, bottom?: number | string, left?: number | string) {
  if (typeof top !== 'number' || top !== right || right !== bottom || bottom !== left) {
    return undefined;
  }
  return top;
}

export function PageStyleFields({
  style,
  disabled,
  onChange,
}: {
  style?: PageStyle;
  disabled?: boolean;
  onChange: (style: PageStyle | undefined, field: 'background' | 'padding' | 'overflow') => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};

  function patch(next: Partial<PageStyle>, field: 'background' | 'padding' | 'overflow') {
    onChange(compactPageStyle({ ...current, ...next }), field);
  }

  return (
    <>
      <Form.Item label={t('lowcode.styleOverflow')}>
        <Select
          size="small"
          disabled={disabled}
          value={
            current.overflow && (OVERFLOW_MODES as readonly string[]).includes(current.overflow)
              ? (current.overflow as OverflowMode)
              : 'auto'
          }
          onChange={(overflow: OverflowMode) =>
            patch({ overflow: overflow === 'auto' ? undefined : overflow }, 'overflow')
          }
          options={OVERFLOW_MODES.map((value) => ({
            value,
            label: t(`lowcode.styleOverflow${value.charAt(0).toUpperCase()}${value.slice(1)}`),
          }))}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.styleBackground')}>
        <ColorPicker
          size="small"
          allowClear
          disabled={disabled}
          value={current.background || null}
          onChange={(value, css) => patch({ background: value.cleared ? undefined : css }, 'background')}
        />
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
              patch(
                {
                  paddingTop: value ?? undefined,
                  paddingRight: value ?? undefined,
                  paddingBottom: value ?? undefined,
                  paddingLeft: value ?? undefined,
                },
                'padding',
              )
            }
            addonAfter="px"
          />
          <div className="style-radius-grid">
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={pageNumber(current.paddingTop)}
              onChange={(paddingTop) => patch({ paddingTop: paddingTop ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeTop')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={pageNumber(current.paddingRight)}
              onChange={(paddingRight) => patch({ paddingRight: paddingRight ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeRight')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={pageNumber(current.paddingBottom)}
              onChange={(paddingBottom) => patch({ paddingBottom: paddingBottom ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeBottom')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={pageNumber(current.paddingLeft)}
              onChange={(paddingLeft) => patch({ paddingLeft: paddingLeft ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeLeft')}
            />
          </div>
        </div>
      </Form.Item>
    </>
  );
}
