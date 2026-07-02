// Fix for sandboxed environment where window.fetch is read-only and formdata-polyfill crashes
if (typeof window !== 'undefined') {
  // 1. Ensure FormData has keys to prevent formdata-polyfill from executing
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

  // 2. Try to make window.fetch writable if it is configurable
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (desc && !desc.writable && desc.configurable) {
      const originalFetch = window.fetch;
      Object.defineProperty(window, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    // Silence error
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
