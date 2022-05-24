const { init } =
	process.type === 'browser'
		? require('@sentry/electron/main')
		: require('@sentry/electron/renderer');

import { environment } from './environments/environment';

export function initSentry() {
	if (environment.SENTRY_DSN) {
		init({ dsn: environment.SENTRY_DSN });
	}
}
