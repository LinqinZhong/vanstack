import ts from 'typescript';

/** 预览里按 JavaScript 执行，类型只留在保存的脚本上。 */
export function eventScriptJavaScript(source: string): string {
  try {
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    }).outputText;
    return output.trim() || source;
  } catch {
    return source;
  }
}
