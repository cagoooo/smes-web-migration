/**
 * 校網遷移與 AA 無障礙實作操作台 — Service Worker
 *
 * 策略（依 skill: favicon-pwa-starter / pwa-cache-bust）：
 *   - HTML：network-first（永遠先拿最新，離線才回快取）
 *   - 其他資源：cache-first + 背景更新
 *   - version.json：永遠走網路（更新偵測的依據，不能被快取）
 *   - install 階段**不呼叫 skipWaiting**，讓新版停在 waiting，
 *     由使用者在更新通知列上決定何時套用
 *
 * ⚠️ 每次部署都要改 BUILD_VERSION（跑 scripts/bump-version.ps1 會自動同步三處），
 *    sw.js 的 byte 沒變的話瀏覽器會當作同一支，永遠不會觸發更新通知。
 */
const BUILD_VERSION = '2026.08.15-2';
const CACHE = 'school-migration-' + BUILD_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './manifest.webmanifest',
  './og-preview.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(PRECACHE.map((u) => c.add(u).catch(() => {}))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('school-migration-') && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED', version: BUILD_VERSION }));
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // 版本檔永遠拿最新，否則更新偵測會失效
  if (url.pathname.endsWith('version.json')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // HTML：network-first
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 其他資源：cache-first + 背景更新
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
