import './polyfill.ts';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initMockApi } from './mockApi.ts';

// Initialize the BWF Real-time API Client Fallback Router
// Disabled to ensure the app always uses the real cloud database server and stays fully in sync across devices.
// if (typeof window !== 'undefined') {
//   initMockApi();
// }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
