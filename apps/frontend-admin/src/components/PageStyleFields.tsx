import { ColorPicker, Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { compactPageStyle, type PageStyle } from '@vanstack/xml';

function unifiedEdges(top?: number, right?: number, bottom?: number, left?: number) {
  if (top == null || top !== right || right !== bottom || bottom !== left) {
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
  onChange: (style: PageStyle | undefined, field: 'background' | 'padding') => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};

  function patch(next: Partial<PageStyle>, field: 'background' | 'padding') {
    onChange(compactPageStyle({ ...current, ...next }), field);
  }

  return (
    <>
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
              value={current.paddingTop}
              onChange={(paddingTop) => patch({ paddingTop: paddingTop ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeTop')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingRight}
              onChange={(paddingRight) => patch({ paddingRight: paddingRight ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeRight')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingBottom}
              onChange={(paddingBottom) => patch({ paddingBottom: paddingBottom ?? undefined }, 'padding')}
              addonAfter="px"
              placeholder={t('lowcode.styleEdgeBottom')}
            />
            <InputNumber
              size="small"
              min={0}
              disabled={disabled}
              value={current.paddingLeft}
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
