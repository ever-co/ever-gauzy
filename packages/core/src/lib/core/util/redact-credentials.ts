/**
 * Helpers that make connection strings and credential headers safe to write to stdout.
 *
 * On Kubernetes, stdout is readable by anyone who can run `kubectl logs` in the namespace and is
 * shipped to whatever log backend is configured, so a boot-time diagnostic line must never carry a
 * password, token or API key. These helpers keep the parts an operator needs (scheme, username,
 * host, port, header names) and replace every credential with {@link REDACTED_CREDENTIAL}.
 *
 * This file is intentionally dependency-free: it is imported from the tracer bootstrap, which runs
 * before the rest of the application is loaded.
 */

/**
 * Placeholder written in place of a credential that must never reach a log line.
 */
export const REDACTED_CREDENTIAL = '***';

/**
 * Matches the scheme prefix of a URL such as `redis://`, `rediss://` or `https://`.
 */
const URL_SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)/;

/**
 * Returns `url` with the credentials in its userinfo section (`scheme://user:password@host`)
 * redacted, so a connection string can be logged without leaking the credential.
 *
 * - `redis://:secret@10.0.0.1:6379` becomes `redis://:***@10.0.0.1:6379`.
 * - `rediss://default:secret@host:6380/0` becomes `rediss://default:***@host:6380/0` - the username is
 *   kept because it is a useful diagnostic and not a secret on its own.
 * - `https://token@host` becomes `https://***@host` - a userinfo without a `:` is treated as a bare
 *   token (the common `https://<token>@github.com` shape), not as a username.
 * - A URL without an `@` has no userinfo and is returned unchanged.
 *
 * The userinfo is taken to end at the LAST `@`, and the value is never handed to `new URL()`:
 * a password containing an unencoded `@`, `/` or `#` would make the URL parser split the
 * authority in the wrong place and let part of the secret through. The trade-off is that an `@`
 * inside a path or query over-redacts - which is safe, where under-redacting is not.
 *
 * @param url - The URL or connection string to redact. `null`/`undefined` yield an empty string.
 * @returns The URL with every credential in its userinfo replaced by {@link REDACTED_CREDENTIAL}.
 */
export function redactUrlCredentials(url: string | null | undefined): string {
	if (!url) return '';

	const value = String(url);
	const lastAt = value.lastIndexOf('@');

	// No `@` anywhere means there is no userinfo section, so there is nothing to redact.
	if (lastAt === -1) return value;

	const scheme = value.match(URL_SCHEME_PATTERN)?.[1] ?? '';
	// An `@` inside the scheme itself is impossible, but guard against a pathological value anyway.
	if (lastAt < scheme.length) return value;

	const userinfo = value.slice(scheme.length, lastAt);
	const rest = value.slice(lastAt + 1);
	const colon = userinfo.indexOf(':');

	const redactedUserinfo = colon === -1 ? REDACTED_CREDENTIAL : `${userinfo.slice(0, colon)}:${REDACTED_CREDENTIAL}`;

	return `${scheme}${redactedUserinfo}@${rest}`;
}

/**
 * Redacts the URL that a URL-parsing error carries, so the error can be logged safely.
 *
 * Node's `ERR_INVALID_URL` - thrown by `new URL()`, including inside the Redis client when it parses
 * its `url` option - stores the offending value verbatim on `error.input`, and `console.error(error)`
 * prints it. A malformed `REDIS_URL` would therefore leak its password through the error path even
 * though the diagnostic `REDIS_URL:` line is redacted. The error is redacted in place (its `input`,
 * and any copy of the value in `message` or `stack`) and returned, so the call site keeps logging
 * the same error object with its stack.
 *
 * If any of those fields cannot be rewritten - a frozen error, a read-only `stack` - a plain
 * summary error carrying only the redacted URL is returned instead: a partially redacted original
 * must never reach the log.
 *
 * @param error - Whatever a `catch` received. Values without a string `input` are returned untouched.
 * @returns The same value, with any embedded URL credentials replaced by {@link REDACTED_CREDENTIAL},
 *          or a redacted summary error when the original could not be fully redacted.
 */
export function redactUrlErrorInput<T>(error: T): T {
	if (!error || typeof error !== 'object') return error;

	const candidate = error as { input?: unknown; message?: unknown; stack?: unknown };
	if (typeof candidate.input !== 'string' || !candidate.input) return error;

	const raw = candidate.input;
	const redacted = redactUrlCredentials(raw);

	// Nothing in the URL is a credential, so there is nothing to hide.
	if (redacted === raw) return error;

	const summary = () => new Error(`URL parsing failed for ${redacted}`) as unknown as T;

	try {
		candidate.input = redacted;
		for (const key of ['message', 'stack'] as const) {
			const value = candidate[key];
			if (typeof value === 'string' && value.includes(raw)) {
				candidate[key] = value.split(raw).join(redacted);
			}
		}
	} catch {
		// Some field could not be rewritten; the ones that were may hide that others were not.
		return summary();
	}

	// A write can also be ignored without throwing; confirm the raw URL is really gone everywhere.
	const stillLeaks = [candidate.input, candidate.message, candidate.stack].some(
		(value) => typeof value === 'string' && value.includes(raw)
	);

	return stillLeaks ? summary() : error;
}

/**
 * Returns a copy of an HTTP header map with every value replaced by {@link REDACTED_CREDENTIAL},
 * keeping the header names so a log line still shows which headers are configured.
 *
 * @param headers - The header map, e.g. `{ Authorization: '<api key>' }`.
 * @returns The redacted copy, or `undefined` when there are no headers.
 */
export function redactHeaderValues(
	headers: Record<string, unknown> | null | undefined
): Record<string, string> | undefined {
	if (!headers) return undefined;

	return Object.fromEntries(Object.keys(headers).map((name) => [name, REDACTED_CREDENTIAL]));
}

/**
 * Redacts every value in a comma-separated `key=value` list, keeping only the keys.
 *
 * This is the format of `OTEL_EXPORTER_OTLP_HEADERS` (e.g. `signoz-access-token=<key>,x-team=<key>`),
 * whose values are ingestion keys. `a=1,b=2` becomes `a=***,b=***`; an entry without a `=` is
 * redacted entirely because there is no way to tell a key from a bare secret.
 *
 * @param list - The comma-separated `key=value` list. `null`/`undefined` yield an empty string.
 * @returns The list with every value replaced by {@link REDACTED_CREDENTIAL}.
 */
export function redactKeyValueList(list: string | null | undefined): string {
	if (!list) return '';

	return String(list)
		.split(',')
		.map((entry) => {
			const equals = entry.indexOf('=');
			return equals === -1 ? REDACTED_CREDENTIAL : `${entry.slice(0, equals).trim()}=${REDACTED_CREDENTIAL}`;
		})
		.join(',');
}
