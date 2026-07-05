// Polyfill for sandboxed environment where window.fetch is read-only and formdata-polyfill crashes
if (typeof window !== 'undefined') {
  // 1. Ensure FormData has keys to prevent formdata-polyfill from executing/crashing
  if (typeof (window as any).FormData === 'undefined') {
    class MockFormData {
      append() {}
      delete() {}
      get() {}
      getAll() {}
      has() {}
      set() {}
      *keys() { yield* []; }
      *values() { yield* []; }
      *entries() { yield* []; }
      *[Symbol.iterator]() { yield* []; }
    }
    (window as any).FormData = MockFormData;
  } else if (!(window as any).FormData.prototype.keys) {
    (window as any).FormData.prototype.keys = function* () { yield* []; };
    (window as any).FormData.prototype.values = function* () { yield* []; };
    (window as any).FormData.prototype.entries = function* () { yield* []; };
    (window as any).FormData.prototype[Symbol.iterator] = function* () { yield* []; };
  }

  // 2. Define getter/setter or writable data descriptor for window.fetch on all targets.
  // We try defining it on multiple objects in the prototype chain so that
  // any third-party assignments (like window.fetch = custom) work without throwing read-only errors.
  let currentFetch = window.fetch;
  let patched = false;

  const targets = [
    window,
    Object.getPrototypeOf(window),
    Window.prototype,
    globalThis
  ];

  for (const target of targets) {
    if (!target) continue;
    
    // First, try defining as a getter/setter accessor property
    try {
      Object.defineProperty(target, 'fetch', {
        get() {
          return currentFetch;
        },
        set(newFetch) {
          currentFetch = newFetch;
        },
        configurable: true,
        enumerable: true
      });
      patched = true;
    } catch (e) {
      // If accessor definition fails (e.g. browser security policy on window),
      // try defining it as a writable, configurable data property
      try {
        Object.defineProperty(target, 'fetch', {
          value: currentFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
        patched = true;
      } catch (err) {
        // Keep trying other targets
      }
    }
  }

  if (!patched) {
    // If defining failed on all targets, attempt a clean delete and re-assignment
    try {
      delete (window as any).fetch;
      (window as any).fetch = currentFetch;
    } catch (e) {
      // Ultimate fallback: do nothing if absolutely restricted
    }
  }
}
