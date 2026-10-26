import { startApi } from './support/api-server';
import { startsApi } from './support/config';

/**
 * Starts the API for the run (unless DESKTOP_E2E_API_URL names one, or DESKTOP_E2E_API=off for the
 * start-up checks alone); the returned function stops it.
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
	if (!startsApi || process.env['DESKTOP_E2E_API'] === 'off') return;
	return startApi();
}
