import * as chalk from 'chalk';

/**
 * Express `trust proxy` value used when `TRUST_PROXY` is unset.
 *
 * One hop: the immediate peer (the reverse proxy / ingress that terminates the connection) is
 * trusted, every address it forwarded is not. That is enough for `req.protocol` — and therefore
 * `cookie: { secure: 'auto' }` in `redis-store.ts` — to keep working behind any proxy, because
 * Express only requires the IMMEDIATE peer to be trusted before reading `X-Forwarded-Proto`. It is
 * NOT enough for a client to inject its own `X-Forwarded-For` entry and become `req.ip`, which the
 * previous unconditional `true` allowed (GHSA-86mw-2crg-vmhc).
 */
export const DEFAULT_TRUST_PROXY = 1;

/**
 * Parsed form of the `TRUST_PROXY` environment variable, in the shapes Express accepts.
 */
export type TrustProxySetting = boolean | number | string[];

/**
 * Resolves the Express `trust proxy` setting from its environment value.
 *
 * Accepted forms (all of which Express understands):
 * - unset / blank → {@link DEFAULT_TRUST_PROXY}
 * - `true` / `false` → trust every proxy / trust none
 * - a non-negative integer → number of hops closest to the app that may be trusted
 * - anything else → comma-separated list of addresses, CIDR ranges or the named presets
 *   (`loopback`, `linklocal`, `uniquelocal`)
 *
 * `true` is honoured because some topologies genuinely need it, but it is announced loudly: with
 * it, `req.ip` (and therefore the rate-limit bucket and every IP written to a log) is whatever the
 * client put at the head of `X-Forwarded-For`.
 *
 * @param raw - The raw `TRUST_PROXY` value.
 * @returns The value to pass to `app.set('trust proxy', ...)`.
 */
export function resolveTrustProxy(raw?: string): TrustProxySetting {
	const value = (raw ?? '').trim();

	if (!value) {
		return DEFAULT_TRUST_PROXY;
	}

	const normalized = value.toLowerCase();

	if (normalized === 'true') {
		// eslint-disable-next-line no-console
		console.warn(
			chalk.yellow(
				'TRUST_PROXY=true trusts the ENTIRE X-Forwarded-For chain, so req.ip — and the rate-limit ' +
					'bucket derived from it — is client-controlled. Prefer the number of proxy hops in front ' +
					'of the API (e.g. TRUST_PROXY=1), or the trusted proxy CIDRs.'
			)
		);
		return true;
	}

	if (normalized === 'false') {
		return false;
	}

	// `Number.parseInt` would happily read "1abc" as 1; require the whole value to be digits.
	if (/^\d+$/.test(normalized)) {
		return Number.parseInt(normalized, 10);
	}

	const list = value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);

	if (list.length === 0) {
		return DEFAULT_TRUST_PROXY;
	}

	return list;
}
