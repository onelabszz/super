const CACHE_NAME = 'console-v4-8';
const APP_SHELL = [
  'admin.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ============ INSTALL: Cache app shell ============
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        APP_SHELL.map(url => 
          cache.add(url).catch(err => console.log('[SW] Skip cache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ============ ACTIVATE: Hapus cache lama ============
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ============ FETCH: Strategi per tipe request ============
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Skip non-GET
  if (e.request.method !== 'GET') return;
  
  // Skip chrome-extension, etc
  if (!url.protocol.startsWith('http')) return;
  
  // ============================================================
  // 1. NAVIGATION REQUESTS (HTML pages) — Network First
  //    INI YANG PALING PENTING — Jangan pernah block navigasi
  // ============================================================
  if (e.request.mode === 'navigate' || 
      (e.request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache successful navigation response
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Fallback ke cache kalau offline
          return caches.match('admin.html') || 
                 caches.match(e.request) || 
                 new Response('App offline. Klik Sync saat online.', {
                   status: 200,
                   headers: { 'Content-Type': 'text/html; charset=utf-8' }
                 });
        })
    );
    return;
  }
  
  // ============================================================
  // 2. GOOGLE APPS SCRIPT API — Network Only
  // ============================================================
  if (url.hostname === 'script.google.com') {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // ============================================================
  // 3. STATIC ASSETS (CSS, JS, IMG) — Cache First with Network Fallback
  // ============================================================
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Return empty response instead of throwing
          if (e.request.destination === 'image') {
            return new Response('', { status: 404 });
          }
          return new Response('', { status: 200 });
        });
    })
  );
});