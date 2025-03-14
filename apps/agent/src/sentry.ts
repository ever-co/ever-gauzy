const { init, IPCMode } =
	process.type === 'browser'
		? require('@sentry/electron/main')
		: require('@sentry/electron/renderer');

import { environment } from './environments/environment';

/**
 * Initializes Sentry for error tracking and monitoring.
 *
 * This function configures Sentry with specific settings such as the DSN, environment,
 * IPC mode, and transport options. It also incorporates a custom logic to handle
 * event queuing based on the online/offline status of the application.
 *
 * Sentry provides robust error tracking, making it easier to debug and monitor
 * application health in production and development environments.
 *
 * Pre-requisites:
 * - The `environment.SENTRY_DSN` must be set to a valid Sentry Data Source Name (DSN).
 * - This setup assumes the `isOnline` function is defined elsewhere to check the
 *   browser's online/offline status.
 *
 * Key Features:
 * - Configures Sentry to use both the main and renderer processes via `IPCMode.Both`.
 * - Limits the number and age of queued events in offline mode.
 * - Dynamically adjusts behavior (`send`, `queue`, or `drop`) based on network status.
 *
 * @example
 * // Call this function during application bootstrap to initialize Sentry
 * initSentry();
 */
export function initSentry(): void {
	if (environment.SENTRY_DSN) {
		init({
			dsn: environment.SENTRY_DSN, // Sentry DSN from environment configuration
			ipcMode: IPCMode.Both, // Enables Sentry in both main and renderer processes
			transportOptions: {
				// Maximum number of days to retain events in the queue
				maxQueueAgeDays: 30,
				// Maximum number of events to retain in the queue
				maxQueueCount: 30,
				// Callback triggered when the queue length changes
				queuedLengthChanged: (length: number): void => {
					console.log(`Sentry queue length changed: ${length}`);
				},
				// Logic to decide whether to send, queue, or drop events
				beforeSend: (): 'send' | 'queue' | 'drop' => {
					// If online, send the event; otherwise, queue it
					return isOnline() ? 'send' : 'queue';
				},
			},
			// Enables debug mode in non-production environments
			debug: !environment.production,
			// Sets the environment context for Sentry
			environment: environment.production ? 'production' : 'development',
		});
	}
}

/**
 * Checks the online status of the user's browser.
 *
 * This function uses the `navigator.onLine` property, which is a boolean
 * indicating whether the browser is currently connected to the network.
 *
 * - `true`: The browser is online and has access to a network.
 * - `false`: The browser is offline, or there is no network connection available.
 *
 * @returns {boolean} `true` if the browser is online, otherwise `false`.
 *
 * Example usage:
 * ```javascript
 * if (isOnline()) {
 *     console.log('You are online!');
 * } else {
 *     console.log('You are offline!');
 * }
 * ```
 */
function isOnline(): boolean {
    return window.navigator.onLine;
}

