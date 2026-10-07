import { Card } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PageI18n } from '@vanstack/xml';
import { AssetLibraryPanel } from '../../../components/AssetLibraryPanel';
import { DataPoolPanel } from '../../../components/DataPoolPanel';
import { IconLibraryPanel } from '../../../components/IconLibraryPanel';
import { LanguageLibraryPanel } from '../../../components/LanguageLibraryModal';
import type { EditorNav } from './EditorRail';

/**
 * 左侧导航离开「开发」后，用对应的库替换画布。leftNav 为 develop 时不渲染。
 * 文案库的改动经 onI18nChange 写回页面草稿；素材库和图标库按 projectId 自己读写资源，不经过页面 XML。
 */
type EditorLibrariesProps = {
  leftNav: EditorNav;
  projectId: string;
  catalog: PageI18n | undefined;
  onI18nChange: (next: PageI18n | undefined, coalesceKey?: string) => void;
};

export function EditorLibraries({ leftNav, projectId, catalog, onI18nChange }: EditorLibrariesProps) {
  const { t } = useTranslation();
  if (leftNav === 'pool') {
    return (
      <Card size="small" className="editor-panel language-library-card" title={t('lowcode.dataPool')}>
        <DataPoolPanel projectId={projectId} />
      </Card>
    );
  }
  if (leftNav === 'i18n') {
    return (
      <Card size="small" className="editor-panel language-library-card" title={t('lowcode.i18nLibrary')}>
        <LanguageLibraryPanel catalog={catalog} onChange={onI18nChange} />
      </Card>
    );
  }
  if (leftNav === 'assets') {
    return (
      <Card size="small" className="editor-panel language-library-card" title={t('lowcode.assetLibrary')}>
        <AssetLibraryPanel projectId={projectId} />
      </Card>
    );
  }
  if (leftNav === 'icons') {
    return (
      <Card size="small" className="editor-panel language-library-card" title={t('lowcode.iconLibrary')}>
        <IconLibraryPanel projectId={projectId} />
      </Card>
    );
  }
  return null;
}
