import { useEffect, useRef, useState } from 'react';
import { Download, HelpCircle, RefreshCw, Share2, X } from 'lucide-react';

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
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as StandaloneNavigator).standalone === true;
}

function isAppleMobileDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function PWAControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [standalone, setStandalone] = useState(isStandaloneApp);
  const [appleMobile] = useState(isAppleMobileDevice);
  const [mobileDevice] = useState(isMobileDevice);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const applyingUpdateRef = useRef(false);

  useEffect(() => {
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let registrationUpdateFound: (() => void) | undefined;
    let hasController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
    const watchedWorkers = new Map<ServiceWorker, () => void>();
    const displayMode = window.matchMedia?.('(display-mode: standalone)');

    const syncStandalone = () => {
      if (active) setStandalone(isStandaloneApp());
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as InstallPromptEvent;
      window.deferredClassBandhuInstall = promptEvent;
      setInstallPrompt(promptEvent);
    };
    const onAppInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      window.deferredClassBandhuInstall = undefined;
      setShowInstallHelp(false);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onControllerChange = () => {
      if (applyingUpdateRef.current || hasController) {
        applyingUpdateRef.current = false;
        window.location.reload();
        return;
      }
      // The first controller claim is the initial install, not an app update.
      hasController = true;
    };
    const checkForUpdates = () => {
      if (document.visibilityState === 'hidden') return;
      void registration?.update().catch(error => {
        console.warn('ClassBandhu update check failed:', error);
      });
    };
    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker || watchedWorkers.has(worker)) return;
      const onStateChange = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      };
      worker.addEventListener('statechange', onStateChange);
      watchedWorkers.set(worker, onStateChange);
      onStateChange();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('pageshow', checkForUpdates);
    document.addEventListener('visibilitychange', checkForUpdates);
    displayMode?.addEventListener('change', syncStandalone);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(value => {
          if (!active) return;
          registration = value;

          if (registration.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
          watchInstallingWorker(registration.installing);

          registrationUpdateFound = () => watchInstallingWorker(registration?.installing ?? null);
          registration.addEventListener('updatefound', registrationUpdateFound);
          checkForUpdates();
        })
        .catch(error => console.error('ClassBandhu service worker registration failed:', error));
    }

    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('pageshow', checkForUpdates);
      document.removeEventListener('visibilitychange', checkForUpdates);
      displayMode?.removeEventListener('change', syncStandalone);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
      if (registration && registrationUpdateFound) {
        registration.removeEventListener('updatefound', registrationUpdateFound);
      }
      for (const [worker, handler] of watchedWorkers) {
        worker.removeEventListener('statechange', handler);
      }
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setStandalone(true);
      setInstallPrompt(null);
      window.deferredClassBandhuInstall = undefined;
    } catch (error) {
      console.error('ClassBandhu installation prompt failed:', error);
    } finally {
      setInstalling(false);
    }
  };

  const applyUpdate = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const waitingWorker = registration?.waiting;
      if (!waitingWorker) {
        setUpdateReady(false);
        return;
      }
      applyingUpdateRef.current = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      applyingUpdateRef.current = false;
      console.error('ClassBandhu update could not be applied:', error);
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {!online && (
        <span role="status" className="inline-flex max-w-full items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900">
          Offline · live data needs internet
        </span>
      )}

      {updateReady ? (
        <button type="button" onClick={() => void applyUpdate()} className="ui-button-secondary whitespace-nowrap" aria-label="Apply the latest ClassBandhu update">
          <RefreshCw className="h-4 w-4" /> Update ready
        </button>
      ) : !standalone && installPrompt ? (
        <button type="button" onClick={() => void installApp()} disabled={installing} className="ui-button-secondary whitespace-nowrap">
          <Download className="h-4 w-4" /> {installing ? 'Installing…' : 'Install app'}
        </button>
      ) : !standalone && mobileDevice ? (
        <button type="button" onClick={() => setShowInstallHelp(true)} className="ui-button-secondary whitespace-nowrap" aria-haspopup="dialog" aria-expanded={showInstallHelp}>
          {appleMobile ? <Share2 className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
          How to install
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
                <p className="mt-1 text-sm leading-5 text-slate-600">Add the workspace to your Home Screen for a standalone app experience.</p>
              </div>
              <button type="button" onClick={() => setShowInstallHelp(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close install instructions">
                <X className="h-4 w-4" />
              </button>
            </div>
            {appleMobile ? (
              <ol className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">1</span><span>Open the browser’s <strong>Share</strong> menu.</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">2</span><span>Choose <strong>Add to Home Screen</strong>.</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">3</span><span>Confirm with <strong>Add</strong>.</span></li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">1</span><span>Open your browser’s menu (usually <strong>⋮</strong>).</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">2</span><span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-[#6B1F38]">3</span><span>Confirm the installation.</span></li>
              </ol>
            )}
            <button type="button" onClick={() => setShowInstallHelp(false)} className="ui-button-primary mt-5 w-full">Done</button>
          </section>
        </div>
      )}
    </div>
  );
}
