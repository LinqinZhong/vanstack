## 1. 增量

- [x] 1.1 新增 `applyRadiusDrag`：向内 45° 为正、`min=0`；`Alt` 四角同值；`Shift` 先吸其它角再吸 5 的倍数

## 2. 协议与辅助层

- [x] 2.1 预览消息 `spacingDrag` 增加 `radius`；圆角分组打开时转发指针
- [x] 2.2 四角切线控制条、遮罩、取消/确定、数值与磁铁图标；关闭分组后去掉
- [x] 2.3 `widgetShortcuts` 增加 `radius`/`border`（`Mod+R`/`Mod+Shift+B`）。确认 `Ctrl+R` 不刷新、`Ctrl+Shift+B` 不切换书签栏；无选中时不改分组

## 3. 画布拖动

- [x] 3.1 主窗口在圆角打开时按角写入 `radiusTopLeft` 等，`edit:${id}:style` 合并撤回
- [x] 3.2 指针滑出控制条或 iframe 仍跟手；圆角不小于 0；`Alt` 松开后保持同值
