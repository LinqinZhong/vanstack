/* 临时探针：给 node 环境补最小浏览器 API，仅用于 SSR 渲染真实运行时管线。用完即删。 */
const noop = () => undefined;
const anyGlobal = globalThis as unknown as Record<string, unknown>;
if (!anyGlobal.window) {
  const fakeElement = {
    style: {},
    appendChild: noop,
    removeChild: noop,
    setAttribute: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const fakeWindow = {
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop }),
    requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(0), 16) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    devicePixelRatio: 1,
    innerWidth: 1440,
    innerHeight: 900,
    location: { origin: 'http://localhost:5174', href: 'http://localhost:5174/preview', search: '' },
    navigator: { userAgent: 'node' },
  } as Record<string, unknown>;
  fakeWindow.document = {
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ ...fakeElement }),
    createTextNode: () => ({}),
    head: fakeElement,
    body: fakeElement,
    documentElement: fakeElement,
  };
  anyGlobal.window = fakeWindow;
  anyGlobal.document = fakeWindow.document;
  try {
    Object.defineProperty(anyGlobal, 'navigator', { value: fakeWindow.navigator, configurable: true });
  } catch {
    /* node 自带只读 navigator，忽略 */
  }
  anyGlobal.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  anyGlobal.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  anyGlobal.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
}
export {};
