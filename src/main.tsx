import './compat';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './glass.css';
import './reader.css';
import './festivities.css';
import './sharing.css';
import './branding.css';
import './ipad.css';
import { nativeAndroid } from './native';
class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="fatal"><h1>Não foi possível abrir o app</h1><p>Suas partituras salvas continuam no aparelho.</p><button onClick={() => location.reload()}>Reabrir aplicativo</button></main> : this.props.children; }
}
async function start() {
  // Um APK antigo registrava o service worker da web. Evita que o cache dele
  // substitua os arquivos incluídos na nova instalação nativa.
  if (nativeAndroid && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      if (navigator.serviceWorker.controller) { location.reload(); return; }
    } catch { /* O APK funciona diretamente com seus próprios arquivos. */ }
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
}
void start();
