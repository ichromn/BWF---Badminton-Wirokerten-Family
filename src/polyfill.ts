// Polyfill for sandboxed environment where window.fetch is read-only and formdata-polyfill crashes
if (typeof window !== 'undefined') {
  // Make window.fetch and globalThis.fetch writable to prevent "TypeError: Cannot set property fetch of #<Window> which has only a getter"
  const makeFetchWritable = (target: any) => {
    try {
      const originalFetch = target.fetch;
      if (originalFetch) {
        Object.defineProperty(target, 'fetch', {
          value: originalFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
    } catch (e) {
      console.warn("Could not redefine fetch on target directly, using getter/setter fallback:", e);
      try {
        let currentFetch = target.fetch;
        Object.defineProperty(target, 'fetch', {
          get() {
            return currentFetch;
          },
          set(val) {
            currentFetch = val;
          },
          configurable: true,
          enumerable: true
        });
      } catch (e2) {
        console.error("Critical: Failed to define fetch setter on target:", e2);
      }
    }
  };

  makeFetchWritable(window);
  if (typeof globalThis !== 'undefined' && globalThis !== window) {
    makeFetchWritable(globalThis);
  }
  if (typeof self !== 'undefined' && self !== window && self !== (globalThis as any)) {
    makeFetchWritable(self);
  }

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
}

