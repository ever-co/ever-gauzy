/**
 * The local development switch of the Ever Works integration: `EVER_WORKS_ALLOW_LOOPBACK=true`.
 *
 * The integration reaches Ever Works over public HTTPS only, and only a public HTTPS `API_BASE_URL` gets a webhook.
 * That leaves no way to run Gauzy against an Ever Works API on the same machine (`http://127.0.0.1:3100/api`), which
 * is what a local end-to-end run of the pair needs. With the switch on, and only in a development or test process,
 * a **loopback** address is accepted as well, over HTTP or HTTPS: `localhost`, `127.0.0.1` or `[::1]`, nothing else.
 * Every other private, link-local or metadata address stays refused, and a production process ignores the switch.
 */

/** The hosts the switch admits: the loopback names and literals only (`URL.hostname` form). */
export const EVER_WORKS_LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The environments where the switch is honoured (`NODE_ENV`). */
const DEVELOPMENT_ENVIRONMENTS: ReadonlySet<string> = new Set(['development', 'test']);

/**
 * Whether `EVER_WORKS_ALLOW_LOOPBACK` is on for this process. Only the exact value `true` in a `NODE_ENV` of
 * `development` or `test` turns it on; set anywhere else (production, or `NODE_ENV` unset) it is ignored with one
 * warning, and any other value is ignored with one warning too.
 */
export function readEverWorksAllowLoopback(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['EVER_WORKS_ALLOW_LOOPBACK'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw !== 'true') {
		warn('EVER_WORKS_ALLOW_LOOPBACK is not "true" or "false"; it is ignored.');
		return false;
	}
	if (!DEVELOPMENT_ENVIRONMENTS.has(env['NODE_ENV'] ?? '')) {
		warn('EVER_WORKS_ALLOW_LOOPBACK is honoured only when NODE_ENV is development or test; it is ignored.');
		return false;
	}
	warn(
		'EVER_WORKS_ALLOW_LOOPBACK is on: loopback Ever Works and webhook addresses are accepted (local development only).'
	);
	return true;
}

/**
 * A loopback URL the switch admits: `http:` or `https:`, a loopback host, no credentials. Its query, fragment and
 * path are checked by the caller like any other URL.
 */
export function isEverWorksLoopbackUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return (
		(url.protocol === 'http:' || url.protocol === 'https:') &&
		!url.username &&
		!url.password &&
		EVER_WORKS_LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
	);
}
