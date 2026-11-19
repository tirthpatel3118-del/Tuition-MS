import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const sidebar = read('../src/components/Sidebar.tsx');
const auth = read('../src/pages/AuthPages.tsx');
const loader = read('../src/components/PageLoader.tsx');
const mark = read('../src/components/EduLedgerMark.tsx');
const brandLoader = read('../src/components/BrandLoading.tsx');
const html = read('../index.html');
const manifest = read('../public/manifest.webmanifest');

assert.match(app, /EduLedgerMark/);
assert.match(app, /Simplifying institute management, one classroom at a time/);
assert.match(app, /v1\.0\.1/);
assert.doesNotMatch(app, /hidden w-full border-t border-\[#E5DDE0\].*md:block/);
assert.match(sidebar, /<EduLedgerMark/);
assert.match(sidebar, /Tuition Management System/);
assert.match(auth, /<BrandLoading message=\{message\} \/>/);
assert.match(loader, /<EduLedgerMark/);
assert.match(brandLoader, /Loading EduLedger/);
assert.match(mark, /viewBox="0 0 64 64"/);
assert.match(html, /<title>EduLedger ERP<\/title>/);
assert.match(manifest, /"short_name": "EduLedger"/);

console.log('EduLedger brand shell checks passed.');
