// Listen for push events
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'KargaX';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'kargax-message',
    data: { url: data.url || '/mensajes' },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Cerrar' }
    ],
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/mensajes';
  event.waitUntil(clients.openWindow(url));
});
