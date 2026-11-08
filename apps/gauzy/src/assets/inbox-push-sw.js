/*
 * The inbox's push worker (Settings -> Notifications -> Browser notifications). A push carries one inbox entry of the
 * signed-in person (title, text, where it opens, a tag so a device shows one notification per entry); the worker
 * shows it, and a click opens the entry, focusing an open tab of the app when there is one.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch (error) {
		payload = { title: event.data ? event.data.text() : '' };
	}
	event.waitUntil(
		self.registration.showNotification(payload.title || 'Inbox', {
			body: payload.body || '',
			tag: payload.tag || undefined,
			icon: 'images/logos/logo_Gauzy_512x512.png',
			data: { url: payload.url || null, itemId: payload.itemId || null }
		})
	);
});

/**
 * Where a click goes: the entry's own link when it is this app's, else this app's Inbox with the entry, below the app's
 * base (the parent of this worker's `assets/` scope: the app may be served below the site's root).
 */
function targetOf(data) {
	const origin = self.location.origin;
	if (data && data.url) {
		try {
			const url = new URL(data.url);
			if (url.origin === origin) return url.href;
		} catch (error) {
			// Not a URL: the Inbox below.
		}
	}
	const item = data && data.itemId ? '?item=' + encodeURIComponent(data.itemId) : '';
	return new URL('../#/pages/inbox' + item, self.registration.scope).href;
}

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = targetOf(event.notification.data);
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				if (new URL(client.url).origin !== self.location.origin) continue;
				try {
					const focused = await client.focus();
					if (focused && 'navigate' in focused) await focused.navigate(target);
					return;
				} catch (error) {
					// A tab this worker does not control cannot be steered: a new one opens below.
				}
			}
			await self.clients.openWindow(target);
		})()
	);
});
