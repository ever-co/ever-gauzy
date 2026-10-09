import { environment } from '@gauzy/ui-config';

/** Path of the settings page, relative to `/pages/settings`. */
export const CONNECTED_IDENTITIES_PATH = 'connected-identities';

/** Absolute link of the settings page. */
export const CONNECTED_IDENTITIES_LINK = `/pages/settings/${CONNECTED_IDENTITIES_PATH}`;

let enabled = false;
let probed = false;

/**
 * The Ever ID sign-in link configured for this web app, or `''` (unset, or still the Docker
 * placeholder the container entrypoint replaces at start).
 */
export function everIdSignInLink(): string {
	const value = (environment.ZITADEL_AUTH_LINK ?? '').trim();
	return value && !value.startsWith('DOCKER_') ? value : '';
}

/**
 * Whether the Settings menu shows "Connected identities".
 *
 * Nothing is requested unless the web app has an Ever ID sign-in link configured; then the API's
 * public config route is asked once. Until it answers (and whenever it does not) the entry stays
 * hidden, so an install without Ever ID sees no change.
 */
export function isEverIdSettingsVisible(): boolean {
	if (!probed) {
		probed = true;
		if (everIdSignInLink()) {
			void probe();
		}
	}
	return enabled;
}

async function probe(): Promise<void> {
	try {
		let base = environment.API_BASE_URL ?? '';
		while (base.endsWith('/')) {
			base = base.slice(0, -1);
		}
		const response = await fetch(`${base}/api/auth/zitadel/config`, { headers: { Accept: 'application/json' } });
		if (response.ok) {
			const config = await response.json();
			enabled = config?.enabled === true;
		}
	} catch {
		enabled = false;
	}
}

/** Test hook: forgets the probe result. */
export function resetEverIdUiState(): void {
	enabled = false;
	probed = false;
}
