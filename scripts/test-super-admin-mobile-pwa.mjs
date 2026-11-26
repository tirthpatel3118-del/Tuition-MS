import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../src/pages/SuperAdminDashboard.tsx");
const pwaControls = read("../src/components/PWAControls.tsx");
const css = read("../src/index.css");
const html = read("../index.html");
const manifest = JSON.parse(read("../public/manifest.webmanifest"));
const serviceWorker = read("../public/sw.js");
const appVersion = read("../src/lib/appVersion.ts");
const packageJson = JSON.parse(read("../package.json"));

// Super Admin is a standalone route, so it must mount the PWA controls itself.
assert.match(dashboard, /import \{ PWAControls \} from "\.\.\/components\/PWAControls"/);
assert.match(dashboard, /<PWAControls\s*\/>/);

// Institute management fields and actions must stay inside the viewport on phones.
assert.match(dashboard, /group\/manage mt-4 min-w-0 w-full max-w-full overflow-hidden/);
assert.match(dashboard, /grid min-w-0 w-full max-w-full grid-cols-1/);
assert.match(dashboard, /box-border mt-1\.5 block w-full min-w-0 max-w-full/);
assert.match(dashboard, /w-full items-center rounded-xl bg-\[#6B1F38\]/);
assert.match(dashboard, /w-full items-center rounded-xl border border-rose-200/);
assert.match(dashboard, /w-full items-center rounded-xl border border-emerald-200/);
assert.match(dashboard, /pb-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\]/);
assert.match(css, /#root \{\s*min-height: 100dvh;\s*min-width: 0;/);
assert.match(css, /main \{\s*min-width: 0;\s*max-width: 100%;\s*overflow-x: clip;/);

// Installed mobile clients get safe viewport insets and can rotate naturally.
assert.match(html, /viewport-fit=cover/);
assert.equal(manifest.display, "standalone");
assert.equal("orientation" in manifest, false);

// Installation prompts, iOS home-screen guidance and service-worker updates.
assert.match(pwaControls, /beforeinstallprompt/);
assert.match(pwaControls, /navigator\.serviceWorker\.register/);
assert.match(pwaControls, /Add to Home Screen/);
assert.match(pwaControls, /display-mode: standalone/);
assert.match(pwaControls, /SKIP_WAITING/);
assert.match(pwaControls, /removeEventListener\('focus'/);
assert.match(pwaControls, /removeEventListener\('online'/);

// The service worker must not cache authenticated Supabase/private API traffic.
assert.match(serviceWorker, /url\.pathname\.startsWith\('\/rest\/'\)/);
assert.match(serviceWorker, /url\.pathname\.startsWith\('\/auth\/'\)/);
assert.match(serviceWorker, /url\.pathname\.startsWith\('\/storage\/'\)/);
assert.match(serviceWorker, /classbandhu-shell-v1\.0\.6/);

// Keep every user-visible version in sync so installed clients can detect the update.
assert.equal(packageJson.version, "1.0.6");
assert.match(appVersion, /APP_VERSION = '1\.0\.6'/);

console.log("Super Admin mobile layout and PWA regression checks passed.");
