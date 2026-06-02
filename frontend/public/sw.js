const CACHE_NAME = 'familyhub-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching initial core assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia de Cache Inteligente para Ativos SPA com cache dinâmico de Bundles
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar chamadas de API, SSE, WebSockets, etc.
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retorna a resposta cacheada e tenta atualizar em background se houver rede
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Falha de rede silenciosa (estamos offline)
          });
        return cachedResponse;
      }

      // Se não estiver no cache, busca na rede e guarda uma cópia no cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Se falhar e for navegação de página, retorna o index.html como fallback offline
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});

// Ouvir notificações push do servidor
self.addEventListener('push', (event) => {
  let payload = { title: 'FamilyHub', body: 'Novas atualizações pendentes!' };
  
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'FamilyHub', body: event.data.text() };
    }
  }

  const options = {
    body: payload.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Tratar clique na notificação para abrir/focar o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
