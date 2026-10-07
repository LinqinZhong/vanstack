import { DatabaseOutlined } from '@ant-design/icons';
import { Button, Empty, Popover, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentProp, PageVariable } from '@vanstack/xml';

export function CopyDataPicker({
  variables,
  componentProps,
  disabled,
  onPick,
}: {
  variables?: PageVariable[];
  componentProps?: ComponentProp[];
  disabled?: boolean;
  onPick: (expression: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const props = componentProps ?? [];
  const data = variables ?? [];
  const empty = props.length === 0 && data.length === 0;

  const content = empty ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.dataPickEmpty')} />
  ) : (
    <div className="copy-i18n-picker">
      {props.length > 0 ? (
        <div className="copy-i18n-picker-group">
          <div className="copy-i18n-picker-title">{t('lowcode.dataPickProps')}</div>
          {props.map((prop) => (
            <button
              key={`props:${prop.name}`}
              type="button"
              className="copy-i18n-picker-item"
              onClick={() => {
                onPick(`$props.${prop.name}`);
                setOpen(false);
              }}
            >
              {prop.desc?.trim() ? `$props.${prop.name} · ${prop.desc.trim()}` : `$props.${prop.name}`}
            </button>
          ))}
        </div>
      ) : null}
      {data.length > 0 ? (
        <div className="copy-i18n-picker-group">
          <div className="copy-i18n-picker-title">{t('lowcode.dataPickVars')}</div>
          {data.map((variable) => (
            <button
              key={`data:${variable.name}`}
              type="button"
              className="copy-i18n-picker-item"
              onClick={() => {
                onPick(`$data.${variable.name}`);
                setOpen(false);
              }}
            >
              {variable.desc?.trim() ? `$data.${variable.name} · ${variable.desc.trim()}` : `$data.${variable.name}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <Popover trigger="click" open={open && !disabled} onOpenChange={setOpen} content={content} destroyOnHidden>
      <Tooltip title={t('lowcode.dataPick')}>
        <Button
          size="small"
          type="text"
          className="inspector-prop-edit"
          disabled={disabled}
          icon={<DatabaseOutlined />}
        />
      </Tooltip>
    </Popover>
  );
}
