import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const sidebar = read('../src/components/Sidebar.tsx');
const css = read('../src/index.css');
const admissions = read('../src/pages/Admissions.tsx');
const auth = read('../src/pages/AuthPages.tsx');
const superAdmin = read('../src/pages/SuperAdminDashboard.tsx');
const platformInvitation = read('../src/pages/PlatformInvitationAcceptancePage.tsx');
const receipts = read('../src/pages/Receipts.tsx');
const attendance = read('../src/pages/Attendance.tsx');
const settings = read('../src/pages/Settings.tsx');
const authContext = read('../src/context/AuthContext.tsx');
const pwaControls = read('../src/components/PWAControls.tsx');
const loader = read('../src/components/PageLoader.tsx');
const mark = read('../src/components/ClassBandhuMark.tsx');
const brandLoader = read('../src/components/BrandLoading.tsx');
const favicon = read('../public/favicon.svg');
const pwaIcon = read('../public/pwa-icon.svg');
const pwaMaskable = read('../public/pwa-maskable.svg');
const html = read('../index.html');
const manifest = read('../public/manifest.webmanifest');
const serviceWorker = read('../public/sw.js');
const packageJson = JSON.parse(read('../package.json'));
const appVersion = read('../src/lib/appVersion.ts');
const versionedPwaIcon = read('../public/pwa-icon-v1.0.2.svg');
const versionedPwaMaskable = read('../public/pwa-maskable-v1.0.2.svg');
const versionedFavicon = read('../public/favicon-v1.0.2.svg');

// Footer content, contact links and version match the supplied reference.
assert.ok(app.includes('ClassBandhu'));
assert.ok(app.includes('Empowering Every Classroom.'));
assert.ok(manifest.includes('Tuition institute workspace for admissions, fees, attendance and academic records.'));
assert.ok(app.includes('info.classbandhu@gmail.com'));
assert.ok(app.includes('mailto:info.classbandhu@gmail.com'));
assert.ok(!app.includes('tirth.freelance31@gmail.com'));
assert.ok(app.includes('+91 81607 33101'));
assert.ok(app.includes('wa.me/918160733101'));
assert.ok(html.includes('<title>ClassBandhu Tuition ERP</title>'));
assert.ok(app.includes('© 2026 ClassBandhu. All rights reserved.'));
assert.ok(app.includes('v{APP_VERSION}'));
assert.ok(brandLoader.includes('v{APP_VERSION}'));
assert.ok(app.includes("import { APP_VERSION } from './lib/appVersion'"));
assert.ok(brandLoader.includes("import { APP_VERSION } from '../lib/appVersion'"));
assert.ok(appVersion.includes(`'${packageJson.version}'`));
assert.equal(packageJson.version, '1.0.6');

const legacyProductName = ['Edu', 'Ledger'].join('');
for (const [surface, content] of Object.entries({ app, sidebar, auth, superAdmin, platformInvitation, receipts, attendance, brandLoader, pwaControls, html, manifest })) {
  assert.ok(!content.includes(legacyProductName), `${surface} still contains the retired product name`);
}

// Phone and tablet layouts use the drawer and bottom navigation until large desktop.
assert.ok(app.includes('xl:hidden'));
assert.ok(sidebar.includes('xl:block'));
assert.ok(sidebar.includes('xl:hidden'));
assert.ok(app.includes('2xl:grid-cols-[minmax(17rem,1fr)_minmax(20rem,1.15fr)_minmax(19rem,1fr)]'));
assert.ok(app.includes('break-all'));
assert.ok(css.includes('overflow-x: hidden'));
assert.ok(css.includes('main table'));
assert.ok(css.includes('max-width: 1279px'));
assert.ok(app.includes('2xl:flex-row'));
assert.ok(app.includes('min-h-dvh'));
assert.ok(admissions.includes('overflow-x-auto bg-white shadow-xs'));

// Institute name stays in the sidebar beside the shared product mark.
assert.ok(sidebar.includes('ClassBandhuMark className='));
assert.ok(sidebar.includes('settings.instituteName'));
assert.ok(sidebar.includes('Institute workspace'));
assert.ok(sidebar.includes("collapsed ? 'xl:hidden' : ''"));
assert.ok(sidebar.includes("window.matchMedia('(min-width: 1280px)')"));
assert.ok(auth.includes('<BrandLoading message={message} />'));
assert.ok(auth.includes('ClassBandhu'));
assert.ok(auth.includes('Empowering Every Classroom.'));
assert.ok(!auth.includes('eduledger/'));
assert.ok(superAdmin.includes('ClassBandhu control center'));
assert.ok(platformInvitation.includes('ClassBandhu access'));
assert.ok(receipts.includes("settings?.instituteName || 'ClassBandhu'"));
assert.ok(receipts.includes('Official Fee Receipt'));
assert.ok(attendance.includes('ClassBandhu · Attendance'));
assert.ok(settings.includes('classbandhu_workspace_snapshot_'));
assert.ok(settings.includes('classbandhu_students_export_'));
assert.ok(authContext.includes('A valid invitation is required to create a ClassBandhu account.'));
assert.ok(authContext.includes("'eduledger.activeInstituteId'")); // Preserve existing local workspace state.
assert.ok(pwaControls.includes('deferredClassBandhuInstall'));
assert.ok(loader.includes('<ClassBandhuMark'));
assert.ok(brandLoader.includes('Loading ClassBandhu'));

// Every UI surface and install identity uses the exact supplied image asset.
const logoAssetPath = new URL('../public/classbandhu-mark-v1.0.3.png', import.meta.url);
const logoAsset = readFileSync(logoAssetPath);
assert.ok(mark.includes('/classbandhu-mark-v1.0.3.png'));
assert.ok(mark.includes('alt="ClassBandhu logo"'));
assert.ok(existsSync(logoAssetPath));
assert.equal(logoAsset.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.ok(favicon.includes('/classbandhu-mark-v1.0.3.png'));
assert.ok(pwaIcon.includes('/classbandhu-mark-v1.0.3.png'));
assert.ok(pwaMaskable.includes('/classbandhu-mark-v1.0.3.png'));
assert.ok(html.includes('<title>ClassBandhu Tuition ERP</title>'));
assert.ok(manifest.includes('"/classbandhu-mark-v1.0.3.png"'));
assert.ok(html.includes('/classbandhu-mark-v1.0.3.png'));
assert.ok(serviceWorker.includes("classbandhu-shell-v1.0.6"));
assert.ok(serviceWorker.includes('/classbandhu-mark-v1.0.3.png'));

console.log('ClassBandhu responsive brand shell checks passed.');
