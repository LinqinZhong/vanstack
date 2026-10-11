const xml = require('./packages/xml/dist/index.js');
const page = { widgets: [ { type: 'component', id: 'c1', componentId: 'compA', componentKey: 'compA', name: 'MyComp', slotContent: { sSlot1: [ { type: 'text', id: 't1', value: 'hello' } ] } } ] };
const doc = xml.normalizePageDocument(page);
console.log('normalized slotContent:', JSON.stringify(doc.widgets[0].slotContent));
const xmlStr = xml.serializePageXml(doc);
console.log('XML:', xmlStr);
const reparsed = xml.parsePageXml(xmlStr);
console.log('REPARSED slotContent:', JSON.stringify(reparsed.widgets[0].slotContent));
