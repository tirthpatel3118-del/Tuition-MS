import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    deferredEduLedgerInstall?: InstallPromptEvent;
  }
}

export function PWAControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as InstallPromptEvent;
      window.deferredEduLedgerInstall = promptEvent;
      setInstallPrompt(promptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    let registration: ServiceWorkerRegistration | undefined;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(value => {
          registration = value;
          const inspect = () => {
            if (registration?.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
          };
          inspect();
          registration.addEventListener('updatefound', () => {
            const worker = registration?.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
            });
          });
          const checkForUpdates = () => { void registration?.update(); };
          window.addEventListener('focus', checkForUpdates);
          window.addEventListener('online', checkForUpdates);
        })
        .catch(error => console.error('EduLedger service worker registration failed:', error));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
    window.deferredEduLedgerInstall = undefined;
    setInstalling(false);
  };

  const applyUpdate = () => {
    navigator.serviceWorker?.getRegistration('/').then(registration => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  if (updateReady) {
    return <button type="button" onClick={applyUpdate} className="ui-button-secondary" aria-label="Refresh EduLedger to apply the latest update">
      <RefreshCw className="h-4 w-4" /> Update ready
    </button>;
  }

  if (installPrompt) {
    return <button type="button" onClick={() => void installApp()} disabled={installing} className="ui-button-secondary">
      <Download className="h-4 w-4" /> {installing ? 'Installing…' : 'Install app'}
    </button>;
  }

  return null;
}
