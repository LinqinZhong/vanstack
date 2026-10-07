import { Button, Tooltip } from 'antd';
import type { ReactNode } from 'react';

/**
 * 组件树工具栏上的图标按钮。
 * 禁用的 Button 不接收指针事件，Tooltip 若直接包在按钮上，悬停时提示出不来。
 * 外面多包一层 span，让提示在按钮禁用时仍然能显示。
 */
type TreeActionButtonProps = {
  title: string;
  icon: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

export function TreeActionButton({ title, icon, disabled, danger, onClick }: TreeActionButtonProps) {
  return (
    <Tooltip title={title}>
      <span>
        <Button size="small" icon={icon} disabled={disabled} danger={danger} onClick={onClick} />
      </span>
    </Tooltip>
  );
}
