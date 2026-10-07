import { Menu, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { modifierShortcutLabel } from '../utils/widgetShortcuts';

type ShortcutItem = {
  keys: string;
  label: string;
};

type ShortcutColumn = {
  title: string;
  items: ShortcutItem[];
};

function shortcutColumns(mod: string, t: (key: string) => string): ShortcutColumn[] {
  return [
    {
      title: t('lowcode.helpShortcutEdit'),
      items: [
        { keys: `${mod}+S`, label: t('lowcode.updateVersion') },
        { keys: `${mod}+Z`, label: t('lowcode.undo') },
        { keys: `${mod}+Shift+Z`, label: t('lowcode.redo') },
        { keys: `${mod}+Y`, label: t('lowcode.redo') },
        { keys: `${mod}+C`, label: t('lowcode.copyWidget') },
        { keys: `${mod}+V`, label: t('lowcode.pasteWidget') },
        { keys: 'Delete', label: t('lowcode.deleteWidget') },
      ],
    },
    {
      title: t('lowcode.helpShortcutText'),
      items: [
        { keys: `${mod}+B`, label: t('lowcode.styleBold') },
        { keys: `${mod}+I`, label: t('lowcode.styleItalic') },
        { keys: `${mod}+U`, label: t('lowcode.styleUnderline') },
        { keys: `${mod}+D`, label: t('lowcode.styleLineThrough') },
        { keys: `${mod}+.`, label: t('lowcode.helpShortcutFontSizeUp') },
        { keys: `${mod}+,`, label: t('lowcode.helpShortcutFontSizeDown') },
        { keys: `${mod}+-`, label: t('lowcode.helpShortcutFontSizeDown') },
      ],
    },
    {
      title: t('lowcode.helpShortcutBox'),
      items: [
        { keys: `${mod}+P`, label: t('lowcode.stylePadding') },
        { keys: `${mod}+M`, label: t('lowcode.styleMargin') },
        { keys: `${mod}+R`, label: t('lowcode.styleBorderRadius') },
        { keys: `${mod}+Shift+B`, label: t('lowcode.styleBorder') },
        { keys: `${mod}+T`, label: t('lowcode.styleSize') },
        { keys: `${mod}+L`, label: t('lowcode.stylePosition') },
        { keys: `${mod}+Shift+R`, label: t('lowcode.styleRotate') },
        { keys: 'Alt', label: t('lowcode.helpShortcutAltMirror') },
        { keys: 'Shift', label: t('lowcode.helpShortcutShiftSnap') },
      ],
    },
    {
      title: t('lowcode.helpShortcutCanvas'),
      items: [
        { keys: 'Tab', label: t('lowcode.helpShortcutTab') },
        { keys: `${mod}+Enter`, label: t('lowcode.helpShortcutChild') },
        { keys: `${mod}+Shift+Enter`, label: t('lowcode.helpShortcutParent') },
        { keys: t('lowcode.helpShortcutEnterTwiceKeys'), label: t('lowcode.helpShortcutEnterTwice') },
        { keys: 'Esc', label: t('lowcode.helpShortcutCancel') },
        { keys: 'Enter', label: t('lowcode.helpShortcutConfirm') },
        { keys: '1–7', label: t('lowcode.helpShortcutDigits') },
        { keys: '1 / 2 / 3', label: t('lowcode.helpShortcutSizeDigits') },
        { keys: '1 / 2 / 3', label: t('lowcode.helpShortcutRotateDigits') },
        { keys: t('lowcode.helpShortcutArrowsKeys'), label: t('lowcode.helpShortcutArrows') },
        { keys: t('lowcode.helpShortcutNumpadKeys'), label: t('lowcode.helpShortcutNumpad') },
      ],
    },
  ];
}

export function EditorHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const modifier = modifierShortcutLabel();
  const columns = shortcutColumns(modifier, t);

  return (
    <Modal
      className="editor-help-modal"
      open={open}
      title={t('lowcode.helpTitle')}
      footer={null}
      width={1080}
      onCancel={onClose}
      styles={{ body: { padding: 0 } }}
    >
      <div className="editor-help-layout">
        <Menu
          className="editor-help-menu"
          mode="inline"
          selectedKeys={['shortcuts']}
          items={[{ key: 'shortcuts', label: t('lowcode.helpShortcuts') }]}
        />
        <div className="editor-help-content">
          <div className="help-shortcut-grid">
            {columns.map((column) => (
              <section key={column.title} className="help-shortcut-col">
                <h4>{column.title}</h4>
                <ul>
                  {column.items.map((item) => (
                    <li key={`${item.keys}:${item.label}`}>
                      <span className="help-shortcut-keys">{item.keys}</span>
                      <span className="help-shortcut-label">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
