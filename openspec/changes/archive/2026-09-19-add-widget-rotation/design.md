## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`WidgetStyle` 没有旋转字段，`widgetCss` 不写 `transform`。盒分组（尺寸 / 边距 / 圆角 / 边框 / 定位）走 `BoxGroup` + `spacingDrag`：快捷键打开、画布控制条、`1`–`7` 选边、方向键与小键盘。`Ctrl+R` / `⌘+R` 已占用为圆角。浏览器 `Ctrl+Shift+R` / `⌘+Shift+R` 默认强制刷新。滑动器轨道自己写 `translate3d`，控件样式落在滑动器根或 `swiper-item` 本体上，两者不共用同一个 `transform`。

## Goals / Non-Goals

**Goals:**

- 把三轴角度做成与其它样式同构的 `WidgetStyle` 字段，解析 / 渲染 / 检查器 / 气泡 / 画布共用。
- 旋转分组复用现有盒分组铬（遮罩、确认取消、`Shift` 吸附、选轴键、小键盘），但操纵件是三轴环而不是四边条。

**Non-Goals:**

- 不引入 `transform-origin`、自定义透视、`scale` / `skew`。
- 不把滑动器轨道的位移与控件旋转合成到同一条 `transform` 字符串。
- 不改圆角快捷键 `Mod+R`。

## Decisions

### 1. 字段落在 `WidgetStyle`，XML 写成带单位的 CSS 角度

```ts
export const ANGLE_UNITS = ['deg', 'rad', 'grad', 'turn'] as const;
export type AngleUnit = (typeof ANGLE_UNITS)[number];
export type AngleValue = { value: number; unit: AngleUnit };

rotateX?: AngleValue;
rotateY?: AngleValue;
rotateZ?: AngleValue;
```

XML：`rotate-x` / `rotate-y` / `rotate-z`，值为 `45deg`、`1.57rad`、`0.25turn`、`50grad`；无单位时按 `deg` 解析。`compactWidgetStyle` 丢掉非有限值与数值 `0`。非法单位或无法解析的字符串视为未设置。`STYLE_KEYS` 纳入三轴。`swiper-item` **不**剥离旋转。

备选：三轴共用一个 `rotate-unit` 属性。否决原因：CSS 角度本就带单位，混用轴时无法往返。

备选：内部只存弧度。否决原因：默认交互与展示都是角度，存 `deg` 才能让 `45deg` 往返不被换成无理数。

换算在 `@vanstack/xml` 提供：先转到 `deg`，再转到目标单位。`1turn = 360deg = 400grad = 2π rad`。切换某轴单位时只改该轴的 `value` + `unit`。

### 2. 渲染写 `transform`，透视放在页面宿主

`widgetCss` 把非空轴按 `rotateX() rotateY() rotateZ()` 拼进 `css.transform`。页面宿主（工作台 `.preview-mount` 与 H5 页面根）设 `perspective: 800px`。不写 `transform-origin`（沿用边框盒中心）。

滑动器：轨道 `translate3d` 仍在内部 track；`widgetCss` 的 `transform` 在滑动器根或 item body。两者嵌套，MUST NOT 互相覆盖。

备选：把 `perspective()` 写进每个控件自己的 `transform`。否决原因：每个控件会有自己的灭点，和「页面宿主透视」不一致，且更难与将来其它 transform 拼接。

### 3. 旋转是独立盒分组，不复用 `BoxQuad`

`BoxGroup` / 协议 `spacingDrag` 增加 `'rotate'`。画布 overlay 在选中盒外画三环（X 水平轴、Y 竖直轴、Z 垂直屏幕）；命中哪环就改哪轴。未按环、在遮罩上拖，按相对控件中心的角位移改 Z。按住 `1`/`2`/`3` 时拖动覆盖环命中：`1→Z`，`2→X`（竖直位移，上为正），`3→Y`（水平位移，右为正）。

增量与单位：先在该轴当前单位下累加（未设置视为 `0deg`）。`deg`/`grad` 向 0 截成整数；`rad`/`turn` 截到 `0.01`。`Shift` 把结果吸到 `15deg` 的等价角。连续拖动合并 `edit:${id}:style`。打开分组时快照三轴，取消一并恢复。

选轴表独立于 size 的 `1`–`3`（宽/高/全）和边距的 `1`–`7`：仅旋转分组打开时用 Z/X/Y。方向键只用上下。小键盘可输入小数点。新模块 `rotateDrag.ts` 负责轴映射、角位移与步进；`ProjectEditorPage` 的 nudge 循环按当前 `openBoxGroup` 分发到 spacing 或 rotate。

备选：把 X/Y/Z 塞进现有四边控制条。否决原因：旋转不是盒边，环才能表达绕轴。

### 4. 快捷键 `Mod+Shift+R`，无选中也挡住刷新

`widgetShortcuts`：`mod && key === 'r' && shift` → `'rotate'`；无 Shift 仍是 `'radius'`。纳入 `isBoxGroupShortcut`。主窗口与 iframe 捕获阶段 `preventDefault`。可编辑输入不拦截。无选中或只读时仍挡住浏览器强制刷新，但不改分组。已打开再按不关掉。`isBoxGroupAllowed` 对所有控件类型返回 true。

气泡：三行 `AngleField`（数值 + 单位）。检查器同样三行。帮助文案增加 `Ctrl+Shift+R` 与旋转的 `1 / 2 / 3`。中英 i18n。

## Risks / Trade-offs

- [`Ctrl+Shift+R` 被浏览器抢走导致丢草稿] → 捕获阶段 `preventDefault`；无选中时也挡住刷新，与 `Ctrl+R` 圆角相同策略。
- [绕 X/Y 无透视时看起来像被压扁] → 宿主统一 `perspective: 800px`；不让作者改距离。
- [旋转后选中盒与操纵环按未变换边框盒对齐，环会和视觉矩形错开] → 接受：命中与数值仍相对布局盒，与 CSS transform 不占布局一致。后续若要跟视觉轮廓，再改测量。
- [小键盘输入 `rad` 需要小数] → 旋转 nudge 允许 `.`；边距 nudge 仍只整像素。
- [同时按 `1` 与 `2` 时上下键给两轴同一数字步进，单位不同则视觉幅度不同] → 接受：步进按各轴自己的单位，不强制先换算成 deg。

## Migration Plan

无数据库或 API 迁移。无旋转属性的旧 XML 继续可解析，视觉不旋转。带非法旋转值的属性丢弃该轴，不使整页失败。
