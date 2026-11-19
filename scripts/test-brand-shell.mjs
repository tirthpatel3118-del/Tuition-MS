import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const sidebar = read('../src/components/Sidebar.tsx');
const auth = read('../src/pages/AuthPages.tsx');
const loader = read('../src/components/PageLoader.tsx');
const mark = read('../src/components/EduLedgerMark.tsx');
const brandLoader = read('../src/components/BrandLoading.tsx');
const favicon = read('../public/favicon.svg');
const pwaIcon = read('../public/pwa-icon.svg');
const pwaMaskable = read('../public/pwa-maskable.svg');
const html = read('../index.html');
const manifest = read('../public/manifest.webmanifest');

// Match the supplied product footer reference without inventing contact details.
assert.ok(app.includes('EduLedgerMark'));
assert.ok(app.includes('Learning Made Organized'));
assert.ok(app.includes('A complete Tuition Management System for Educational Institutes.'));
assert.ok(app.includes('Empowering Education. Together.'));
assert.ok(app.includes('© 2026 EduLedger. All rights reserved.'));
assert.ok(app.includes('v1.0.1'));
assert.ok(!app.includes('info@eduledger.in'));
assert.ok(!app.includes('98765 43210'));

// Institute name stays in the sidebar beside the shared product mark.
assert.ok(sidebar.includes('EduLedgerMark className='));
assert.ok(sidebar.includes('settings.instituteName'));
assert.ok(sidebar.includes('Institute workspace'));
assert.ok(auth.includes('<BrandLoading message={message} />'));
assert.ok(loader.includes('<EduLedgerMark'));
assert.ok(brandLoader.includes('Loading EduLedger'));

// Shared mark and install icons consistently depict a graduation cap and open book.
assert.ok(mark.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(mark.includes('Open book'));
assert.ok(favicon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(pwaIcon.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(pwaMaskable.includes('M5 19.5L32 7.5L59 19.5'));
assert.ok(html.includes('<title>EduLedger ERP</title>'));
assert.ok(manifest.includes('"short_name": "EduLedger"'));

console.log('EduLedger brand shell checks passed.');
