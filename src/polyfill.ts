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

  // 2. Define a getter and setter for window.fetch.
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
      break;
    } catch (e) {
      // Keep trying other targets
    }
  }

  if (!patched) {
    // If defining getter/setter failed completely, we can try to delete the property first
    // (if it is configurable but has a getter/setter we couldn't modify)
    try {
      delete (window as any).fetch;
      (window as any).fetch = currentFetch;
    } catch (e) {
      // If delete fails, try defining directly as writable value
      try {
        Object.defineProperty(window, 'fetch', {
          value: currentFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        // Fallback: if we absolutely cannot make window.fetch writable, we wrap it in a Proxy if possible,
        // or we just handle assignments by logging warnings.
      }
    }
  }
}
