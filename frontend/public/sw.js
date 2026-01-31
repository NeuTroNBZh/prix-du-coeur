/**
 * Service Worker pour Prix du Coeur
 * Gère le cache et le mode hors-ligne
 */

const CACHE_NAME = 'prix-du-coeur-v4';
const STATIC_CACHE = 'static-v4';
const API_CACHE = 'api-v4';

// Fichiers à mettre en cache immédiatement
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Mise en cache des fichiers statiques');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de cache pour les requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes vers d'autres domaines
  if (url.origin !== location.origin) return;

  // Stratégie pour les fichiers statiques (CSS, JS, images)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Stratégie pour l'API - Network first avec fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Pour les autres requêtes (HTML) - Network first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

/**
 * Vérifie si c'est un asset statique
 */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname);
}

/**
 * Stratégie Cache First
 * Retourne le cache si disponible, sinon fetch
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache first error:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stratégie Network First
 * Essaie le réseau d'abord, sinon retourne le cache
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Mettre en cache les réponses réussies
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Pour les requêtes HTML, retourner la page d'accueil en cache
    if (request.headers.get('Accept')?.includes('text/html')) {
      const indexCache = await caches.match('/index.html');
      if (indexCache) {
        return indexCache;
      }
    }
    
    return new Response(JSON.stringify({ 
      error: 'Offline',
      message: 'Vous êtes hors-ligne'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Écoute les messages du client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
