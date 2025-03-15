// Service Worker for CometChat Push Notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(
    caches.open('cometchat-static-v1').then((cache) => {
      return cache.addAll([
        '/', // Cache the root path
        '/index.html',
        '/static/js/main.chunk.js', // Main app bundle
        '/static/js/vendors~main.chunk.js', // Vendor bundle
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('cometchat-') && cacheName !== 'cometchat-static-v1';
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Handle push notifications from CometChat
self.addEventListener('push', (event) => {
  console.log('Push notification received', event);

  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.message || 'New message received',
      icon: '/logo192.png', // Make sure this icon exists in your public folder
      badge: '/logo192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification('Self Advocacy Wins', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

// Handle fetch events for offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch new
      return response || fetch(event.request);
    })
  );
}); 