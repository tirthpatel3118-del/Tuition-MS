import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share2, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

declare global {
  interface Window {
    deferredClassBandhuInstall?: InstallPromptEvent;
  }
}

function isStandaloneApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as StandaloneNavigator).standalone === true;
}

function isAppleMobileDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function PWAControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneApp());
    setAppleMobile(isAppleMobileDevice());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as InstallPromptEvent;
      window.deferredClassBandhuInstall = promptEvent;
      setInstallPrompt(promptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    let registration: ServiceWorkerRegistration | undefined;
    const onControllerChange = () => window.location.reload();
    const checkForUpdates = () => {
      void registration?.update().catch(error => {
        console.warn('ClassBandhu update check failed:', error);
      });
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

          const onUpdateFound = () => {
            const worker = registration?.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
            });
          };

          registration.addEventListener('updatefound', onUpdateFound);
          window.addEventListener('focus', checkForUpdates);
          window.addEventListener('online', checkForUpdates);
        })
        .catch(error => console.error('ClassBandhu service worker registration failed:', error));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('online', checkForUpdates);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
      else setInstallPrompt(null);
      window.deferredClassBandhuInstall = undefined;
    } catch (error) {
      console.error('ClassBandhu installation prompt failed:', error);
    } finally {
      setInstalling(false);
    }
  };

  const applyUpdate = async () => {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <>
      {updateReady ? (
        <button type="button" onClick={() => void applyUpdate()} className="ui-button-secondary whitespace-nowrap" aria-label="Refresh ClassBandhu to apply the latest update">
          <RefreshCw className="h-4 w-4" /> Update ready
        </button>
      ) : installPrompt && !standalone ? (
        <button type="button" onClick={() => void installApp()} disabled={installing} className="ui-button-secondary whitespace-nowrap">
          <Download className="h-4 w-4" /> {installing ? 'Installing…' : 'Install app'}
        </button>
      ) : appleMobile && !standalone ? (
        <button type="button" onClick={() => setShowInstallHelp(true)} className="ui-button-secondary whitespace-nowrap" aria-haspopup="dialog" aria-expanded={showInstallHelp}>
          <Share2 className="h-4 w-4" /> Add to Home Screen
        </button>
      ) : null}

      {showInstallHelp && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowInstallHelp(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="classbandhu-install-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="classbandhu-install-title" className="text-base font-bold text-slate-900">Install ClassBandhu</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">Add the app to your Home Screen for a full-screen workspace.</p>
              </div>
              <button type="button" onClick={() => setShowInstallHelp(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close install instructions">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">1</span><span>Open ClassBandhu in your browser.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">2</span><span>Open the browser’s <strong>Share</strong> menu.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">3</span><span>Choose <strong>Add to Home Screen</strong>, then confirm.</span></li>
            </ol>
            <button type="button" onClick={() => setShowInstallHelp(false)} className="ui-button-primary mt-5 w-full">Done</button>
          </section>
        </div>
      )}
    </>
  );
}
