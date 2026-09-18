import { Form, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FLEX_ALIGN_CONTENTS,
  FLEX_ALIGN_ITEMS,
  FLEX_ALIGN_SELFS,
  FLEX_DIRECTIONS,
  FLEX_DISPLAYS,
  FLEX_JUSTIFY_CONTENTS,
  FLEX_WRAPS,
  compactFlexContainer,
  compactFlexItem,
  type FlexContainerStyle,
  type FlexItemStyle,
} from '@vanstack/xml';

function enumOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function FlexContainerFields({
  style,
  disabled,
  onChange,
}: {
  style?: FlexContainerStyle;
  disabled?: boolean;
  onChange: (style: FlexContainerStyle | undefined) => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};
  const unifiedGap = current.rowGap != null && current.rowGap === current.columnGap ? current.rowGap : undefined;

  function patch(next: Partial<FlexContainerStyle>) {
    onChange(compactFlexContainer({ ...current, ...next }));
  }

  return (
    <>
      <div className="style-section">{t('lowcode.styleFlex')}</div>
      <Form.Item label={t('lowcode.flexDisplay')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.display}
          onChange={(display) => patch({ display: display || undefined })}
          options={enumOptions(FLEX_DISPLAYS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexDirection')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.flexDirection}
          onChange={(flexDirection) => patch({ flexDirection: flexDirection || undefined })}
          options={enumOptions(FLEX_DIRECTIONS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexWrap')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.flexWrap}
          onChange={(flexWrap) => patch({ flexWrap: flexWrap || undefined })}
          options={enumOptions(FLEX_WRAPS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexJustify')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.justifyContent}
          onChange={(justifyContent) => patch({ justifyContent: justifyContent || undefined })}
          options={enumOptions(FLEX_JUSTIFY_CONTENTS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexAlignItems')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.alignItems}
          onChange={(alignItems) => patch({ alignItems: alignItems || undefined })}
          options={enumOptions(FLEX_ALIGN_ITEMS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexAlignContent')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.alignContent}
          onChange={(alignContent) => patch({ alignContent: alignContent || undefined })}
          options={enumOptions(FLEX_ALIGN_CONTENTS)}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexGap')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={unifiedGap}
          onChange={(value) => patch({ rowGap: value ?? undefined, columnGap: value ?? undefined })}
          addonAfter="px"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexRowGap')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.rowGap}
          onChange={(rowGap) => patch({ rowGap: rowGap ?? undefined })}
          addonAfter="px"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexColumnGap')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.columnGap}
          onChange={(columnGap) => patch({ columnGap: columnGap ?? undefined })}
          addonAfter="px"
        />
      </Form.Item>
    </>
  );
}

export function FlexItemFields({
  style,
  disabled,
  onChange,
}: {
  style?: FlexItemStyle;
  disabled?: boolean;
  onChange: (style: FlexItemStyle | undefined) => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};

  function patch(next: Partial<FlexItemStyle>) {
    onChange(compactFlexItem({ ...current, ...next }));
  }

  return (
    <>
      <div className="style-section">{t('lowcode.styleFlexItem')}</div>
      <Form.Item label={t('lowcode.flexOrder')}>
        <InputNumber
          size="small"
          disabled={disabled}
          value={current.order}
          onChange={(order) => patch({ order: order ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexGrow')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.flexGrow}
          onChange={(flexGrow) => patch({ flexGrow: flexGrow ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexShrink')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.flexShrink}
          onChange={(flexShrink) => patch({ flexShrink: flexShrink ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.flexBasis')}>
        <div className="style-border-row">
          <Select
            size="small"
            allowClear
            disabled={disabled}
            value={current.flexBasis === 'auto' ? 'auto' : undefined}
            placeholder="px"
            onChange={(value) => patch({ flexBasis: value === 'auto' ? 'auto' : undefined })}
            options={[{ value: 'auto', label: t('lowcode.flexBasisAuto') }]}
          />
          <InputNumber
            size="small"
            min={0}
            disabled={disabled}
            value={typeof current.flexBasis === 'number' ? current.flexBasis : undefined}
            onChange={(value) => patch({ flexBasis: value ?? undefined })}
            addonAfter="px"
          />
        </div>
      </Form.Item>
      <Form.Item label={t('lowcode.flexAlignSelf')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.alignSelf}
          onChange={(alignSelf) => patch({ alignSelf: alignSelf || undefined })}
          options={enumOptions(FLEX_ALIGN_SELFS)}
        />
      </Form.Item>
    </>
  );
}
