/** The longest installation address kept here (the connection row's `publicUrl`). */
export const MAX_PUBLIC_URL = 255;

/**
 * The address to publish, normalised as Ever Platform normalises it (lower-case host, no default
 * port, `/` for an empty path), or `null` when `value` may not be published ({@link publicAddress})
 * or is longer than this installation keeps.
 */
export function normalisedPublicAddress(value: unknown): string | null {
	if (!publicAddress(value)) {
		return null;
	}
	const href = new URL(String(value)).href;
	return href.length <= MAX_PUBLIC_URL ? href : null;
}

/**
 * Whether `value` may be published as the installation's address: https, a host name (no IP
 * address literal, no credentials, no port 0), no query or fragment.
 */
export function publicAddress(value: unknown): boolean {
	if (typeof value !== 'string' || !/^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(value)) {
		return false;
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	const host = url.hostname;
	return (
		url.protocol === 'https:' &&
		!url.username &&
		!url.password &&
		url.port !== '0' &&
		!/^[0-9.]+$/.test(host) &&
		!host.startsWith('[') &&
		host.includes('.')
	);
}
