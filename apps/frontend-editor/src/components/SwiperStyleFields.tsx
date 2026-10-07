import { ColorPicker, Form, InputNumber, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { SWIPER_EASINGS, compactSwiper, isCopyBinding, type SwiperStyle } from '@vanstack/xml';

function enumOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

function colorValue(value: string | undefined) {
  if (!value || isCopyBinding(value)) {
    return undefined;
  }
  return value;
}

export function SwiperFields({
  style,
  disabled,
  onChange,
}: {
  style?: SwiperStyle;
  disabled?: boolean;
  onChange: (style: SwiperStyle | undefined) => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};

  function patch(next: Partial<SwiperStyle>) {
    onChange(compactSwiper({ ...current, ...next }));
  }

  return (
    <>
      <div className="style-section">{t('lowcode.styleSwiper')}</div>
      <Form.Item label={t('lowcode.swiperIndicatorDots')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.indicatorDots)}
          onChange={(indicatorDots) => patch({ indicatorDots: indicatorDots || undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperIndicatorColor')}>
        <ColorPicker
          size="small"
          allowClear
          disabled={disabled}
          value={colorValue(current.indicatorColor)}
          onChange={(value, css) => patch({ indicatorColor: value.cleared ? undefined : css })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperIndicatorActiveColor')}>
        <ColorPicker
          size="small"
          allowClear
          disabled={disabled}
          value={colorValue(current.indicatorActiveColor)}
          onChange={(value, css) => patch({ indicatorActiveColor: value.cleared ? undefined : css })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperAutoplay')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.autoplay)}
          onChange={(autoplay) => patch({ autoplay: autoplay || undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperCurrent')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.current}
          onChange={(value) => patch({ current: value ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperInterval')}>
        <InputNumber
          size="small"
          min={1}
          disabled={disabled}
          value={current.interval}
          onChange={(interval) => patch({ interval: interval ?? undefined })}
          addonAfter="ms"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperDuration')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.duration}
          onChange={(duration) => patch({ duration: duration ?? undefined })}
          addonAfter="ms"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperCircular')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.circular)}
          onChange={(circular) => patch({ circular: circular || undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperVertical')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.vertical)}
          onChange={(vertical) => patch({ vertical: vertical || undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperPreviousMargin')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.previousMargin}
          onChange={(previousMargin) => patch({ previousMargin: previousMargin ?? undefined })}
          addonAfter="px"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperNextMargin')}>
        <InputNumber
          size="small"
          min={0}
          disabled={disabled}
          value={current.nextMargin}
          onChange={(nextMargin) => patch({ nextMargin: nextMargin ?? undefined })}
          addonAfter="px"
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperDisplayMultipleItems')}>
        <InputNumber
          size="small"
          min={1}
          disabled={disabled}
          value={current.displayMultipleItems}
          onChange={(displayMultipleItems) => patch({ displayMultipleItems: displayMultipleItems ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperSnapToEdge')}>
        <Switch
          size="small"
          disabled={disabled}
          checked={Boolean(current.snapToEdge)}
          onChange={(snapToEdge) => patch({ snapToEdge: snapToEdge || undefined })}
        />
      </Form.Item>
      <Form.Item label={t('lowcode.swiperEasing')}>
        <Select
          size="small"
          allowClear
          disabled={disabled}
          value={current.easingFunction}
          onChange={(easingFunction) => patch({ easingFunction: easingFunction || undefined })}
          options={enumOptions(SWIPER_EASINGS)}
        />
      </Form.Item>
    </>
  );
}
