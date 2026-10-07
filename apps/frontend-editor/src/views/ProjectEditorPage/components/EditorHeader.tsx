import { ArrowLeftOutlined, QuestionCircleOutlined, SaveOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProjectDto } from '@vanstack/shared';
import { CommitChangesButton } from './CommitChangesButton';

/**
 * 编辑器顶栏：返回项目列表、项目名和 key，以及版本、帮助、保存。
 * 版本侧栏已经打开时不再显示「显示版本」，避免和侧栏上的折叠按钮重复。
 * 只读版本或没有未保存改动时保存按钮禁用。快捷键文案用页面算好的 modifier（macOS 为 ⌘，其它平台为 Ctrl）。
 */
type EditorHeaderProps = {
  project: ProjectDto;
  versionsOpen: boolean;
  modifier: string;
  saveDisabled: boolean;
  onShowVersions: () => void;
  onOpenHelp: () => void;
  onSave: () => void;
};

export function EditorHeader({
  project,
  versionsOpen,
  modifier,
  saveDisabled,
  onShowVersions,
  onOpenHelp,
  onSave,
}: EditorHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="editor-header">
      <Space>
        <Link to="/">
          <Button size="small" icon={<ArrowLeftOutlined />}>
            {t('lowcode.backHome')}
          </Button>
        </Link>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {project.name}
        </Typography.Title>
        <Typography.Text type="secondary">{project.key}</Typography.Text>
      </Space>
      <Space align="center">
        {versionsOpen ? null : (
          <Button size="small" icon={<UnorderedListOutlined />} onClick={onShowVersions}>
            {t('lowcode.showVersions')}
          </Button>
        )}
        <Button size="small" icon={<QuestionCircleOutlined />} onClick={onOpenHelp}>
          {t('lowcode.help')}
        </Button>
        <CommitChangesButton projectId={project.id} />
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          title={`${t('lowcode.updateVersion')} (${modifier}+S)`}
          disabled={saveDisabled}
          onClick={onSave}
        >
          {t('lowcode.updateVersion')}
        </Button>
      </Space>
    </div>
  );
}
