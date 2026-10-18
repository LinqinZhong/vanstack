/* 临时探针：用真实运行时管线做 SSR，检查插槽调试态下的行内样式。用完即删。 */
import './__probe_stubs';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LowcodePage } from '../../../packages/lowcode-runtime/src/page';

const docPath =
  'C:/Users/raink/Desktop/workspace/vanstack/apps/frontend-editor-server/data/projects/579da1f2-be3e-4ca4-b14a-0f4eadbabf9a/mongo/component.version/47bf2300-ab55-4306-8e64-98b46b053d07.json';
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

const CASES: Array<string | null> = [null, 'nmv54q37d-2', 'nmv54p6k0-1'];

for (const slotDebugId of CASES) {
  const html = renderToStaticMarkup(
    createElement(LowcodePage as never, {
      page: doc,
      editing: true,
      centerContent: true,
      slotChrome: true,
      slotDebugId,
      componentEditing: false,
    } as never),
  );
  console.log(`==== slotDebugId=${slotDebugId} len=${html.length}`);
  const pageTag = html.match(/<div class="lowcode-page[^>]*>/);
  console.log('page: ' + (pageTag ? pageTag[0] : '(none)'));
  const tags = html.match(/<div[^>]*data-widget-id="[^"]*"[^>]*>/g) || [];
  for (const tag of tags) {
    const id = (tag.match(/data-widget-id="([^"]*)"/) ?? [])[1];
    const cls = (tag.match(/class="([^"]*)"/) ?? [])[1];
    const style = (tag.match(/style="([^"]*)"/) ?? [])[1];
    console.log(`  ${id} | cls=${cls} | style=${style}`);
  }
  const idx = html.indexOf('nmvc6t4sx-2');
  if (idx >= 0) {
    console.log('  text-tail: ' + html.slice(idx, idx + 200).replace(/\n/g, ' '));
  }
}
