// Service Worker — Koman Global Services
// Cache-first for the app shell, so the site opens instantly offline.
// Firestore itself handles its own offline sync via IndexedDB (enabled in the app).

const CACHE_NAME = 'koman-gs-v2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.jpg',
    './icon-512.jpg'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch strategy:
// - Firebase/Firestore/Google API requests: always go to network (Firestore SDK manages its own offline cache via IndexedDB)
// - Everything else (the app shell): network-first, falling back to cache when offline
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Never intercept Firebase/Firestore/Google traffic — let the Firestore SDK's
    // own offline persistence layer handle that entirely.
    if (
        url.includes('firestore.googleapis.com') ||
        url.includes('firebaseio.com') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com')
    ) {
        return; // let it hit the network normally; SDK handles offline queuing
    }

    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() =>
                caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Fallback to the app shell for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                })
            )
    );
});
