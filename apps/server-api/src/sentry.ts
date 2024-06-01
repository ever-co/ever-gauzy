const { init, IPCMode } =
	process.type === 'browser' ? require('@sentry/electron/main') : require('@sentry/electron/renderer');

import { environment } from './environments/environment';

export function initSentry() {
	if (environment.SENTRY_DSN) {
		init({
			dsn: environment.SENTRY_DSN,
			debug: !environment.production,
			environment: environment.production ? 'production' : 'development',
			ipcMode: IPCMode.Both,
			transportOptions: {
				// The maximum number of days to keep an event in the queue.
				maxQueueAgeDays: 30,
				// The maximum number of events to keep in the queue.
				maxQueueCount: 30,
				// Called every time the number of requests in the queue changes.
				queuedLengthChanged: (length) => { },
				// Called before attempting to send an event to Sentry. Used to override queuing behavior.
				//
				// Return 'send' to attempt to send the event.
				// Return 'queue' to queue and persist the event for sending later.
				// Return 'drop' to drop the event.
				beforeSend: (request) => (isOnline() ? 'send' : 'queue')
			}
		});
	}
}

function isOnline() {
	return window.navigator.onLine;
}
