import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const sidebar = read('../src/components/Sidebar.tsx');
const css = read('../src/index.css');
const admissions = read('../src/pages/Admissions.tsx');
const auth = read('../src/pages/AuthPages.tsx');
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
const versionedPwaIcon = read('../public/pwa-icon-v1.0.1.svg');
const versionedPwaMaskable = read('../public/pwa-maskable-v1.0.1.svg');
const versionedFavicon = read('../public/favicon-v1.0.1.svg');

// Footer content, contact links and version match the supplied reference.
assert.ok(app.includes('ClassBandhu'));
assert.ok(app.includes('Empowering Every Classroom.'));
assert.ok(app.includes('A complete Tuition Management System for Educational Institutes.'));
assert.ok(app.includes('info.classbandhu@gmail.com'));
assert.ok(app.includes('mailto:info.classbandhu@gmail.com'));
assert.ok(!app.includes('tirth.freelance31@gmail.com'));
assert.ok(app.includes(''));
assert.ok(app.includes(''));
assert.ok(app.includes('ClassBandhu Tuition · Tuition Management Platform'));
assert.ok(app.includes('© 2026 ClassBandhu. All rights reserved.'));
assert.ok(app.includes('v{APP_VERSION}'));
assert.ok(brandLoader.includes('v{APP_VERSION}'));
assert.ok(app.includes("import { APP_VERSION } from './lib/appVersion'"));
assert.ok(brandLoader.includes("import { APP_VERSION } from '../lib/appVersion'"));
assert.ok(appVersion.includes(`'${packageJson.version}'`));
assert.equal(packageJson.version, '1.0.1');

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
assert.ok(loader.includes('<ClassBandhuMark'));
assert.ok(brandLoader.includes('Loading ClassBandhu'));

// Shared mark and install icons consistently depict a graduation cap and open book.
assert.ok(mark.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(mark.includes('Open book'));
assert.ok(favicon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(pwaIcon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(pwaMaskable.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(html.includes('<title>ClassBandhu ERP</title>'));
assert.ok(manifest.includes('"short_name": "ClassBandhu"'));
assert.ok(manifest.includes('/pwa-icon-v1.0.1.svg'));
assert.ok(manifest.includes('/pwa-maskable-v1.0.1.svg'));
assert.ok(html.includes('/favicon-v1.0.1.svg'));
assert.ok(versionedFavicon.includes('width="64" height="64"'));
assert.ok(versionedFavicon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(html.includes('/favicon-v1.0.1.svg'));
assert.ok(versionedPwaIcon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(versionedPwaMaskable.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(serviceWorker.includes("classbandhu-shell-v1.0.1"));
assert.ok(serviceWorker.includes('/pwa-icon-v1.0.1.svg'));
assert.ok(serviceWorker.includes('/pwa-maskable-v1.0.1.svg'));

console.log('ClassBandhu responsive brand shell checks passed.');
