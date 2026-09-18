## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageWidget` 为 `text` / `button` / `flex` 递归树；`parseWidgets` 只识别这三类，`widgetTree.ts` 与 `addWidgetToTree` 把「可插入容器」写成 `type === 'flex'`。`renderPageXml(container, xml)` 用纯 `createElement` 输出静态 DOM，不接收编辑/预览模式。工作台用宿主 class `.preview-host.is-editing` 画编辑铬，且仅在 XML 变化时重新调用渲染。项目中没有滑动器依赖。

## Goals / Non-Goals

**Goals:**

- 把 `swiper` / `swiper-item` 纳入现有 XML 树与属性管道（kebab-case、缺省不序列化），不引入新包。
- 用同一份 DOM 结构同时服务编辑展开与运行时轮播：编辑态全部 item 可见，预览/H5 按属性轮播。
- 把工作台的容器判定从「仅 flex」推广到 flex / swiper / swiper-item，插入规则按规格区分允许的子类型。

**Non-Goals:**

- 不引入 Swiper.js 或其它轮播库。
- 不把工作台 postMessage 协议放进 `@vanstack/lowcode-runtime`。
- 不改页面/版本 API、OSS 键。
- 本期不做指示点以外的导航按钮/滚动条、3D 翻转等特效，也不做拖拽排序 item。
- `skip-hidden-item-layout` 等纯性能开关不进入检查器。

## Decisions

### 1. XML 标签与 AST：`swiper` + `swiper-item`

```ts
type SwiperEasing = 'default' | 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic';

type SwiperStyle = {
  indicatorDots?: boolean;
  indicatorColor?: string;
  indicatorActiveColor?: string;
  autoplay?: boolean;
  current?: number;
  interval?: number;
  duration?: number;
  circular?: boolean;
  vertical?: boolean;
  previousMargin?: number; // px
  nextMargin?: number; // px
  displayMultipleItems?: number;
  snapToEdge?: boolean;
  easingFunction?: SwiperEasing;
};

type PageWidget =
  | { type: 'text'; /* 既有 */ }
  | { type: 'button'; /* 既有 */ }
  | { type: 'flex'; /* 既有，children 可含 swiper */ }
  | {
      type: 'swiper';
      id: string;
      children: PageWidget[]; // 运行时只应含 swiper-item
      style?: WidgetStyle;
      swiper?: SwiperStyle;
      item?: FlexItemStyle;
    }
  | {
      type: 'swiper-item';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
    };
```

解析按父级过滤：`swiper` 的直接子节点只收 `swiper-item`；`swiper-item` / `flex` / 页面根收 `text`、`button`、`flex`、`swiper`，忽略错位的 `swiper-item`。序列化标签为 `swiper` 与 `swiper-item`。布尔真值写 `true`，默认假值不落盘。长度与现有边框一致：无单位数字表示 px。非法枚举/非数字/非正 `interval` 丢弃该字段。

`current` 是初始页下标，检查器写入 XML；预览/H5 里手势或自动播放只改运行时偏移，MUST NOT 回写 XML。

属性集合对齐微信小程序 / uni-app `swiper`，而不是 Swiper.js 全量模块：与弹性盒「覆盖完整、但有界的官方属性集」同一策略。

备选：子节点直接当幻灯片、不单独 `swiper-item`。否决原因：编辑态示意是多个空页框，且内容应落在页内而不是把文本本身当成整页。

备选：引入 `swiper` npm 包。否决原因：编辑态要同时铺开全部 item，与库的 overflow/transform 冲突；runtime 目前零第三方 UI 依赖。

### 2. `renderPageXml` 增加 `editing` 渲染提示

```ts
renderPageXml(container, xml, options?: { editing?: boolean })
```

缺省 `editing: false`（H5 与工作台预览模式）。`editing: true` 时：

- 轨道 `display: flex`、`transform` 固定为无偏移，item 均分容器主轴（水平并排 / 垂直堆叠随 `vertical`），`overflow: visible`。
- 不绑定手势、不启动 `autoplay`、不渲染会挡住点选的指示点层（或 `pointer-events: none` 且不切换）。
- 每个 `.lowcode-swiper-item` 带仅编辑态描边与最小高度，不写入 `style` 属性。

非编辑态：轨道按 `current`（越界钳到最后一页）与 `display-multiple-items` 计算位移；`previous-margin` / `next-margin` 作为两侧露出；`circular` 在 item ≥ 2 时用下标取模，不克隆 DOM；触摸拖拽 + `interval` 定时器实现自动播放；`easing-function` 映射为 CSS `transition-timing-function`。

实现上用 runtime 内一个小型 `SwiperView` 组件（`useEffect` 管定时器与 pointer），其余控件继续 `createElement`。工作台协议仍留在 admin：`PreviewPage` 在 **xml 或 mode 变化** 时调用 `renderPageXml(..., { editing: mode !== 'preview' })`——现状只在 xml 变化时渲染，否则切到编辑态无法关掉自动播放。

备选：不改函数签名，靠 `.is-editing` 祖先 class 切换。否决原因：runtime 不应依赖工作台 class 名；且不重渲染时定时器仍会跑。

### 3. 工作台树操作：按允许的子类型插入

把 `widgetTree.ts` 里所有 `type === 'flex'` 的下降/更新改成「凡带 `children` 的节点」（flex / swiper / swiper-item）。插入与粘贴另写 `canContain(parent, childType)`：

| 父级 | 允许的子类型 |
|---|---|
| page / flex / swiper-item | text, button, flex, swiper |
| swiper | swiper-item |

`addWidget`：

- 新增 `swiper`：`children` 为 3 个空 `swiper-item`（新 id）。
- 选中 `swiper` 且添加 `swiper-item` → 追加到该滑动器。
- 选中 `swiper` 且添加其它类型 → 追加到最后一个 item；若没有 item 则先建一个。
- 选中 `swiper-item` 且添加 `swiper-item` → 作为下一个兄弟插入父滑动器。
- 选中 `swiper-item` 且添加其它类型 → 追加为该 item 子控件。
- 选中 `flex` → 沿用现规则，允许加入 `swiper`。
- `swiper-item` 不得落到页面根或 flex。

检查器：选中 `swiper` 展示全部 `SwiperStyle` 字段 + 盒样式（隐藏字体类，与 flex 相同）；选中 `swiper-item` 只展示盒样式。父级为 flex 时，`swiper` 仍展示弹性项目字段。

添加入口在类型选择里增加「滑动器」「滑动器页」。

### 4. 编辑铬留在宿主 CSS

admin `.preview-host.is-editing .lowcode-swiper-item` 提供红色实线描边（对应用户示意）与空页最小高度；H5 样式只复位间距、不画描边。item 作为 flex 项目时，与 `.lowcode-flex > *` 一样去掉旧的横向 margin。

`WidgetStyleFields` 的 `widgetType` 联合类型加上 `swiper` | `swiper-item`。

## Risks / Trade-offs

- [自定义轮播在 `circular` + `display-multiple-items` 边缘不如成熟库圆滑] → 规格覆盖取模与钳位即可；不做无限克隆 DOM。
- [PreviewPage 过去不因 mode 重渲染] → 显式在 mode 变化时重渲染，避免编辑态仍 autoplay。
- [穷尽匹配 `PageWidget['type']` 漏掉新类型] → xml 解析、runtime、树 helper、添加入口、检查器、clone/paste 全部显式分支。
- [默认 3 个空 item 与「空 swiper 仍合法」并存] → 解析允许 0 个 item；仅工作台「添加滑动器」预填 3 个。
- [点击 item 内子控件无法选中外层 swiper] → 与 flex 相同，接受 `closest` 选最内层，改外层走控件树。

## Migration Plan

1. 先扩展 `@vanstack/xml` 类型与解析/序列化，用含嵌套 item 与全属性的示例往返；再用旧的 `text`/`button`/`flex` XML 确认不变。
2. 改 runtime：`SwiperView` + `editing` 选项；再改 `PreviewPage` 在 mode 变化时重渲染。
3. 改 admin 树/插入/检查器/i18n 与两端 CSS。
4. 验证：添加滑动器见 3 个描边页框 → 往 item 加文本 → 改全属性后切预览见轮播 → 存版本再读回一致；同一 XML 在 H5 结构一致且无编辑描边。
5. 回滚：还原 xml/runtime/admin/app 即可。含 `swiper` 的版本在旧代码中会被当成未知元素忽略。

## Open Questions

- 编辑态 item 描边的具体线宽与空页最小高度可在实现时按画布观感微调，不影响规格与任务切分。
