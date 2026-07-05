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
}

