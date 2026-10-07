import type { FocusEvent, ReactNode } from 'react';

/**
 * 包住一组会连续改草稿的输入。焦点离开这一整块时调用 onLeave，让页面结束当前合并键，
 * 下一次修改另起一条撤销记录。
 * relatedTarget 仍在容器内部时不结束：在同一组字段之间切换焦点，仍算同一次编辑。
 */
type CoalesceFieldProps = {
  onLeave: () => void;
  children: ReactNode;
};

export function CoalesceField({ onLeave, children }: CoalesceFieldProps) {
  return (
    <div
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }
        onLeave();
      }}
    >
      {children}
    </div>
  );
}
