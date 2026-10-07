import { Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/** 路由上的项目 id 对不上任何项目时的占位。只提示文案并链回首页，不发保存或拉草稿。 */
export function ProjectMissing() {
  const { t } = useTranslation();
  return (
    <Card>
      <Typography.Paragraph>{t('lowcode.projectMissing')}</Typography.Paragraph>
      <Link to="/">{t('lowcode.backHome')}</Link>
    </Card>
  );
}
