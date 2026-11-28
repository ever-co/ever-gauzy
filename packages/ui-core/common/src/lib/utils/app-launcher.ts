import {
	CURRENT_EVER_APP_ID,
	EVER_PLATFORM_ADD_APP_PATH,
	EVER_PLATFORM_APP_ID,
	IEverApp,
	isCurrentEverApp
} from '../constants/ever-apps.constants';
import { withEverAppLinks } from './ever-app-links';

/**
 * Where the App Launcher (the shortcut to the other Ever apps) sits, the person's choice on the profile page:
 * - `sidebar`: the turning Ever mark at the top of the sidebar opens it;
 * - `header`: a grid button at the right end of the top bar opens it, and the mark stays a plain mark;
 * - `rail`: a narrow column left of the sidebar with one icon per app.
 *
 * On a phone the top bar has no room and the rail is not drawn, so there the mark opens the list whatever the
 * position.
 *
 * The values and the storage key are Ever Teams' (`app-switcher-placement`), so every Ever app reads alike.
 */
export type AppLauncherPlacement = 'sidebar' | 'header' | 'rail';

/** The positions in the order the preferences page shows them. */
export const APP_LAUNCHER_PLACEMENTS: ReadonlyArray<AppLauncherPlacement> = ['sidebar', 'header', 'rail'];

/**
 * The position for a person who never chose one: the sidebar, where the Ever mark has opened the app list since
 * 2026-11-05, so nobody's screen changes until they pick another position.
 */
export const DEFAULT_APP_LAUNCHER_PLACEMENT: AppLauncherPlacement = 'sidebar';

/** The `localStorage` key of the position (Ever Teams' key). The choice applies to this browser only. */
export const APP_LAUNCHER_PLACEMENT_STORAGE_KEY = 'app-switcher-placement';

/** The narrowest viewport (px) that shows the rail or the top bar's button: Nebular's and Ever Teams' `md`. */
export const APP_LAUNCHER_WIDE_MIN_WIDTH = 768;

export function isAppLauncherPlacement(value: unknown): value is AppLauncherPlacement {
	return APP_LAUNCHER_PLACEMENTS.some((placement) => placement === value);
}

/**
 * The stored position, or the default when nothing valid is stored. Reads both forms: the JSON string Ever Teams
 * writes (`"rail"`, with the quotes) and a bare value (`rail`).
 *
 * @param raw - The stored value (`localStorage.getItem`), `null` when unset.
 */
export function parseAppLauncherPlacement(raw: string | null | undefined): AppLauncherPlacement {
	if (raw === null || raw === undefined) {
		return DEFAULT_APP_LAUNCHER_PLACEMENT;
	}
	const value = raw.trim();
	if (isAppLauncherPlacement(value)) {
		return value;
	}
	try {
		const parsed: unknown = JSON.parse(value);
		if (isAppLauncherPlacement(parsed)) {
			return parsed;
		}
	} catch {
		// Not JSON: an unknown value, which means the default.
	}
	return DEFAULT_APP_LAUNCHER_PLACEMENT;
}

/** The value to store for a position: a JSON string, as Ever Teams stores it. */
export function serializeAppLauncherPlacement(placement: AppLauncherPlacement): string {
	return JSON.stringify(placement);
}

/**
 * The current app's row as this deployment serves it: its own `CLIENT_BASE_URL` (a self-hosted installation is not
 * the Ever-hosted one), or the catalog's entry when that setting is missing or is not a web address.
 */
export function withDeploymentAddress(app: IEverApp, clientBaseUrl: string | null | undefined): IEverApp {
	if (!isCurrentEverApp(app) || !clientBaseUrl) {
		return app;
	}
	try {
		const { protocol, host } = new URL(clientBaseUrl);
		const isWebAddress = protocol === 'http:' || protocol === 'https:';
		if (!isWebAddress || !host) {
			return app;
		}
		return { ...app, url: clientBaseUrl, domain: host };
	} catch {
		return app;
	}
}

/**
 * The App Launcher's list as this deployment serves it: the catalog (`EVER_APPS`, in its order), each app at the
 * address the deployment's `EVER_APP_LINKS` gives (the catalog's otherwise), and the current app at the
 * deployment's own `CLIENT_BASE_URL`, which `EVER_APP_LINKS` never changes.
 *
 * @param catalog - The Ever apps (`EVER_APPS`).
 * @param everAppLinks - The `EVER_APP_LINKS` setting.
 * @param clientBaseUrl - The `CLIENT_BASE_URL` setting.
 */
export function resolveEverApps(
	catalog: ReadonlyArray<IEverApp>,
	everAppLinks: string | null | undefined,
	clientBaseUrl: string | null | undefined
): ReadonlyArray<IEverApp> {
	return withEverAppLinks(catalog, everAppLinks, [CURRENT_EVER_APP_ID]).map((app) =>
		withDeploymentAddress(app, clientBaseUrl)
	);
}

/**
 * Where the launcher's "+ Add" row goes: the page of Ever Platform where a person adds their own apps
 * (`/apps?add=app`), at the Ever Platform address the list gives, so each environment reaches its own Ever
 * Platform. `null` when the list has no Ever Platform with a web address: the row is then not shown, and a
 * self-hosted installation shows nothing of Ever Platform.
 *
 * @param apps - The App Launcher's list, as this deployment serves it (`resolveEverApps`).
 */
export function everAppAddUrl(apps: ReadonlyArray<IEverApp>): string | null {
	const platform = apps.find((app) => app.id === EVER_PLATFORM_APP_ID);
	if (!platform?.url) {
		return null;
	}
	try {
		const base = new URL(platform.url);
		const isWebAddress = base.protocol === 'https:' || base.protocol === 'http:';
		if (!isWebAddress || !base.host) {
			return null;
		}
		return new URL(EVER_PLATFORM_ADD_APP_PATH, base).href;
	} catch {
		return null;
	}
}
