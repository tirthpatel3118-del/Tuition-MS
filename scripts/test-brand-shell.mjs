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

// Product footer uses EduLedger's own brand and published contact details.
assert.match(app, /EduLedgerMark/);
assert.match(app, /Learning Made Organized/);
assert.match(app, /A complete Tuition Management System for Educational Institutes/);
assert.match(app, /info@eduledger\.in/);
assert.match(app, /\+91 98765 43210/);
assert.match(app, /mailto:info@eduledger\.in/);
assert.match(app, /tel:\+919876543210/);
assert.match(app, /v1\.0\.1/);
assert.doesNotMatch(app, /settings\.logoUrl/);

// Institute identity remains in the sidebar header, not the product footer.
assert.match(sidebar, /settings\.logoUrl/);
assert.match(sidebar, /settings\.instituteName/);
assert.match(sidebar, /Institute workspace/);
assert.match(auth, /<BrandLoading message=\{message\} \/>/);
assert.match(loader, /<EduLedgerMark/);
assert.match(brandLoader, /Loading EduLedger/);

// Shared mark and install icons now consistently depict a graduation cap and open book.
assert.match(mark, /M5 19\.5L32 7\.5L59 19\.5/);
assert.match(mark, /Open book/);
assert.match(favicon, /M5 19\.5L32 7\.5L59 19\.5/);
assert.match(pwaIcon, /M5 19\.5L32 7\.5L59 19\.5/);
assert.match(pwaMaskable, /M5 19\.5L32 7\.5L59 19\.5/);
assert.match(html, /<title>EduLedger ERP<\/title>/);
assert.match(manifest, /"short_name": "EduLedger"/);

console.log('EduLedger brand shell checks passed.');
