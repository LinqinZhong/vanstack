const x = require('./packages/xml/dist/index.js');
const { pageCssText } = require('./packages/lowcode-runtime/dist/css.js');

const xml = `<page>
  <flex id="f1">
    <_ name="hover" />
    <text id="t1" value="hi">
      <__ name="hover">
        <_ name="initial" margin-left="10" />
      </__>
    </text>
  </flex>
</page>`;
const p = x.parsePageXml(xml);

// Simulate viewing: f1 is in 'hover' state, t1 is in nested 'initial' state
const viewing = [
  { ownerId: 'f1', state: 'hover' },
  { ownerId: 't1', state: 'initial' },
];

const sink = new WeakMap();
const resolved = x.resolveWidgetTree(p.widgets, viewing, { stateLayersSink: sink });

const f1 = resolved[0];
const t1 = f1.children[0];

console.log('f1 data-state would be:', sink.get(f1)?.map(l => l.name).join(' '));
console.log('t1 data-state would be:', sink.get(t1)?.map(l => l.name).join(' '));
console.log('t1 resolved style:', JSON.stringify(t1.style));
console.log('---CSS---');
console.log(pageCssText(p.widgets));
