import { GlobalOutlined } from '@ant-design/icons';
import { Button, Empty, Popover, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatI18nCopy, type PageI18n } from '@vanstack/xml';

export function CopyI18nPicker({
  catalog,
  disabled,
  onPick,
}: {
  catalog?: PageI18n;
  disabled?: boolean;
  onPick: (expression: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const groups = catalog?.groups ?? [];
  const hasEntries = groups.some((group) => group.entries.length > 0);

  const content = hasEntries ? (
    <div className="copy-i18n-picker">
      {groups.map((group) =>
        group.entries.length === 0 ? null : (
          <div key={group.key} className="copy-i18n-picker-group">
            <div className="copy-i18n-picker-title">{group.key}</div>
            {group.entries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className="copy-i18n-picker-item"
                onClick={() => {
                  onPick(formatI18nCopy(group.key, entry.key));
                  setOpen(false);
                }}
              >
                {entry.key}
              </button>
            ))}
          </div>
        ),
      )}
    </div>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.i18nEmptyEntries')} />
  );

  return (
    <Popover trigger="click" open={open && !disabled} onOpenChange={setOpen} content={content} destroyOnHidden>
      <Tooltip title={t('lowcode.i18nPick')}>
        <Button
          size="small"
          type="text"
          className="inspector-prop-edit"
          disabled={disabled}
          icon={<GlobalOutlined />}
        />
      </Tooltip>
    </Popover>
  );
}
