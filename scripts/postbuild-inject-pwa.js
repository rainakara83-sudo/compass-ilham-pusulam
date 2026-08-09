const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const HTML_PATH = path.join(DIST_DIR, 'index.html');

const PWA_TAGS = [
  '<meta name="theme-color" content="#2F3B25"/>',
  '<link rel="manifest" href="/manifest.json"/>',
  '<link rel="icon" type="image/png" href="/icon-192.png"/>',
  '<meta name="apple-mobile-web-app-capable" content="yes"/>',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default"/>',
  '<meta name="apple-mobile-web-app-title" content="Compass"/>',
  '<link rel="apple-touch-icon" href="/icon-192.png"/>',
  '<link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png"/>',
  '<link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png"/>',
].join('');

if (!fs.existsSync(HTML_PATH)) {
  console.warn('postbuild-inject-pwa: dist/index.html not found, skipping');
  process.exit(0);
}

let html = fs.readFileSync(HTML_PATH, 'utf8');
if (html.includes('rel="manifest"')) {
  console.log('postbuild-inject-pwa: PWA tags already present, skipping');
  process.exit(0);
}

html = html.replace(/<meta name="viewport"[^/]*?\/>/, (m) => m + PWA_TAGS);
fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log('postbuild-inject-pwa: PWA tags injected into dist/index.html');
