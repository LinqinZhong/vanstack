import { AppstoreOutlined, CodeOutlined, DatabaseOutlined, FolderOpenOutlined, GlobalOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * 最左侧竖条当前选中的库。
 * develop 显示页面列表和组件树；数据池、文案、素材、图标由 EditorLibraries 换掉画布。
 * 切换只改导航，不改页面草稿。
 */
export type EditorNav = 'develop' | 'pool' | 'i18n' | 'assets' | 'icons';

type EditorRailProps = {
  value: EditorNav;
  onChange: (value: EditorNav) => void;
};

export function EditorRail({ value, onChange }: EditorRailProps) {
  const { t } = useTranslation();
  return (
    <nav className="editor-rail" aria-label={`${t('lowcode.i18nDevelop')} / ${t('lowcode.dataPool')} / ${t('lowcode.i18nLibrary')} / ${t('lowcode.assetLibrary')}`}>
      <Tooltip title={t('lowcode.i18nDevelop')} placement="right">
        <button
          type="button"
          className={['editor-rail-btn', value === 'develop' ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange('develop')}
        >
          <CodeOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('lowcode.dataPool')} placement="right">
        <button
          type="button"
          className={['editor-rail-btn', value === 'pool' ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange('pool')}
        >
          <DatabaseOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('lowcode.i18nLibrary')} placement="right">
        <button
          type="button"
          className={['editor-rail-btn', value === 'i18n' ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange('i18n')}
        >
          <GlobalOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('lowcode.assetLibrary')} placement="right">
        <button
          type="button"
          className={['editor-rail-btn', value === 'assets' ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange('assets')}
        >
          <FolderOpenOutlined />
        </button>
      </Tooltip>
      <Tooltip title={t('lowcode.iconLibrary')} placement="right">
        <button
          type="button"
          className={['editor-rail-btn', value === 'icons' ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange('icons')}
        >
          <AppstoreOutlined />
        </button>
      </Tooltip>
    </nav>
  );
}
