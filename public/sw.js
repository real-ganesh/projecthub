// Save this as public/sw.js — NOT inside app/, directly in the
// "public" folder at your project root (same level as package.json's
// sibling folders). This file must be a plain .js file, not .tsx.

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : { title: 'ProjectHub', body: 'You have a new notification' }

  event.waitUntil(
    self.registration.showNotification(data.title || 'ProjectHub', {
      body: data.body || '',
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})