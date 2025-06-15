import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import global styles
import './styles/index.css';

// Import polyfills para WebRTC
import 'webrtc-adapter';

// React 18 Strict Mode y createRoot
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render the app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hot Module Replacement (HMR) para desarrollo
if (import.meta.hot) {
  import.meta.hot.accept();
}

// Service Worker registration para PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Configuración de performance monitoring
if (import.meta.env.PROD) {
  // Aquí puedes agregar tu servicio de monitoreo (Sentry, etc.)
}

// Console message para desarrollo
if (import.meta.env.DEV) {
  console.log('🚀 Nexus Frontend iniciado en modo desarrollo');
  console.log('🌐 API URL:', import.meta.env.VITE_API_URL);
  console.log('🔌 WebSocket URL:', import.meta.env.VITE_WS_URL);
}