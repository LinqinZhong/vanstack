// 最小复现：父控件有「激活」状态 s3；子控件根组有「手机」s2（带动画），
// 嵌套组（s3 作用域下）有「默认」s4。验证：
// 1) 父激活 + 子 stateFn=手机 时，子控件同时处于 s2 与 s4（不同父亲可共存）；
// 2) 冲突属性（color）由更深的 s4 胜出；非冲突属性（手机 fontSize）保留；
// 3) 动画按合并规则继承：s4 未定义动画 → 继承 s2 的动画。
const { resolveWidgetTree } = require('@vanstack/xml');

const s2 = { id: 's2', name: '手机', style: { color: 'blue', fontSize: 12 }, animation: { id: 'anim1', duration: 1, mode: 'repeat', easing: 'linear' } };
const s4 = { id: 's4', name: '默认', style: { color: 'red' } }; // 激活下的默认：只改颜色
const s3 = { id: 's3', name: '激活' };

const parent = {
  id: 'p1', type: 'flex', style: {}, states: [s3], stateFn: 'return "s3"',
  children: [
    {
      id: 'w1', type: 'button', style: { color: 'black', fontSize: 16 },
      states: [s2],
      stateFn: 'return "s2"',
      stateOverrides: [{ id: 's3', states: [s4] }],
    },
  ],
};

const sink = new WeakMap();
const resolved = resolveWidgetTree([parent], null, {
  appliedStateFor: (widget, inheritedIds) => {
    // 模拟运行时 resolveRuntimeOwnState 的分组逻辑（简化版）：
    const { resolveStateFnId, appliedStateId, nestedAppliedStateId } = require('@vanstack/xml');
    const designated = resolveStateFnId(widget, { data: {} });
    const out = [];
    if (designated && widget.states?.some((s) => s.id === designated)) out.push(designated);
    else if (designated) { const a = appliedStateId(widget); if (a) out.push(a); }
    for (const scopeId of inheritedIds) {
      const ov = widget.stateOverrides?.find((o) => o.id === scopeId);
      const nested = ov?.states ?? [];
      if (nested.length === 0) continue;
      if (designated && nested.some((s) => s.id === designated)) { out.push(designated); continue; }
      const pick = nestedAppliedStateId(ov) ?? nested.find((s) => s.id)?.id;
      if (pick && !out.includes(pick)) out.push(pick);
    }
    return out;
  },
  stateLayersSink: sink,
});

const w1 = resolved[0].children[0];
const layers = sink.get(w1);
console.log('layers(data-state):', layers.map((l) => `${l.id}:${l.role}`).join(' '));
console.log('merged style:', JSON.stringify(w1.style));
console.log('merged animation:', JSON.stringify(w1.animation));

const expect = (name, cond) => console.log(cond ? `PASS ${name}` : `FAIL ${name}`);
expect('同时处于 s3(继承) + s2(手机) + s4(激活的默认)', layers.map((l) => l.id).join(',') === 's3,s2,s4');
expect('冲突 color 由更深的 s4(red) 胜出', w1.style.color === 'red');
expect('非冲突 fontSize 保留 s2(12)', w1.style.fontSize === 12);
expect('动画继承自 s2(anim1)', w1.animation?.id === 'anim1');
