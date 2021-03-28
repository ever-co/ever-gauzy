const { init } =
	process.type === 'browser'
		? require('@sentry/electron/dist/main')
		: require('@sentry/electron/dist/renderer');
import { environment } from './environments/environment';
export function initSentry() {
	if (environment.SENTRY_DSN) {
		init({ dsn: environment.SENTRY_DSN });
	}
}
