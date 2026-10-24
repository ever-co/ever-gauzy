/** Listen address that accepts connections from this computer only. */
export const DESKTOP_LOOPBACK_HOST = '127.0.0.1';

/** Listen address that accepts connections from every network interface (other computers included). */
export const DESKTOP_ALL_INTERFACES_HOST = '0.0.0.0';

/** The part of the stored `configs` this module reads. */
export interface DesktopLanAccessSetting {
	/**
	 * Gauzy Server and Gauzy API Server only: whether other computers on the network may connect to
	 * the API and the web UI. Set in the setup screen and in the settings.
	 */
	lanAccess?: unknown;
}

/**
 * Whether a server app's setting lets other computers connect.
 *
 * Only `false` turns it off. An install from before the setting existed has no value and keeps what
 * it did then: it listened on every interface, so remote timers and browsers on the LAN could connect.
 *
 * @param setting - The stored `configs`, possibly missing on a first run.
 */
export function isDesktopLanAccessEnabled(setting?: DesktopLanAccessSetting | null): boolean {
	return setting?.lanAccess !== false;
}

/**
 * The address the API launched by a desktop app (and Gauzy Server's web UI server) listens on.
 *
 * - Gauzy Desktop's integrated server and the Desktop Timer's local API (`allowLanAccess` false):
 *   always the loopback address. Nothing on the network can reach them, whatever is stored.
 * - Gauzy Server and Gauzy API Server (`allowLanAccess` true): every interface, unless the user
 *   turned LAN access off, then the loopback address.
 *
 * @param setting - The stored `configs`.
 * @param allowLanAccess - Whether the app may listen on the network at all (the server apps).
 */
export function resolveDesktopListenHost(
	setting: DesktopLanAccessSetting | null | undefined,
	allowLanAccess: boolean
): string {
	return allowLanAccess && isDesktopLanAccessEnabled(setting) ? DESKTOP_ALL_INTERFACES_HOST : DESKTOP_LOOPBACK_HOST;
}

/**
 * A URL a client can actually open for a server listening on `url`'s host.
 *
 * `0.0.0.0` is a listen address, not a destination: Windows refuses to connect to it and Chromium
 * blocks it, so a URL built from the default host setting (`http://0.0.0.0`) points at the loopback
 * address instead. Any other host (a LAN address, a name) is returned unchanged.
 *
 * @param url - A base URL such as `http://0.0.0.0` or `http://0.0.0.0:3000`.
 */
export function toReachableDesktopUrl(url: string): string {
	return url.replace(/^(https?:\/\/)0\.0\.0\.0(?=[:/]|$)/i, `$1${DESKTOP_LOOPBACK_HOST}`);
}

/**
 * The URL this computer's clients (the app's windows, the web UI's API URL, the browser "open in
 * browser" starts, the API's own `API_BASE_URL`) use for a server listening on `listenHost`.
 *
 * A server listening on the loopback address only cannot be reached at a LAN address or a name, so
 * the URL's host becomes the loopback address (scheme, port and path kept). The host setting itself
 * is not changed: turning LAN access back on uses it again. A server listening on every interface
 * keeps the URL, made reachable by {@link toReachableDesktopUrl}.
 *
 * @param url - A base URL built from the host setting, such as `http://192.168.1.20:3000`.
 * @param listenHost - The address the server listens on ({@link resolveDesktopListenHost}).
 */
export function toDesktopClientUrl(url: string, listenHost: string): string {
	const reachable = toReachableDesktopUrl(url);
	if (listenHost !== DESKTOP_LOOPBACK_HOST) {
		return reachable;
	}
	return reachable.replace(/^(https?:\/\/)(\[[^\]]*\]|[^/:?#]*)/i, `$1${DESKTOP_LOOPBACK_HOST}`);
}
