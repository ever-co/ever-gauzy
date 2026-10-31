/**
 * Making a request URL safe to write to a log.
 *
 * A URL is the one part of a request the HTTP request log writes, and it can carry secrets in two places: the
 * query string (`?token=…`, `?code=…` on an OAuth callback, `?email=…`) and route parameters
 * (`/public/invoice/:id/:token`, `/shared-entity/token/:token`). Both are redacted by parameter NAME, and a value
 * that looks like a JWT is redacted wherever it appears, whatever its name. Everything else is kept as it was
 * received (still percent-encoded), so a line can neither be split by a decoded newline nor lose information a
 * developer needs.
 */

/** What a redacted value is replaced with. */
export const REDACTED_VALUE = '[REDACTED]';

/** URLs longer than this are cut, so one oversized request cannot flood the log. */
export const MAX_LOGGED_URL_LENGTH = 1024;

/**
 * Words that make a parameter sensitive. A name is split into words on separators and camelCase (`access_token`,
 * `accessToken` and `X-Access-Token` all contain `token`), and redacted when any word is in this list. The list
 * errs on the side of hiding a value: `currencyCode` is redacted along with an OAuth `code`.
 */
export const DEFAULT_SENSITIVE_PARAMETER_WORDS: readonly string[] = [
	'token',
	'tokens',
	'password',
	'passwd',
	'pwd',
	'secret',
	'auth',
	'authorization',
	'apikey',
	'key',
	'session',
	'sid',
	'cookie',
	'credential',
	'credentials',
	'signature',
	'sig',
	'jwt',
	'bearer',
	'otp',
	'code',
	'pin',
	'hash',
	'salt',
	'email'
];

/** Fragments that make a name sensitive even when written without separators (`accesstoken`, `newpassword`). */
const SENSITIVE_FRAGMENTS: readonly string[] = [
	'token',
	'password',
	'passwd',
	'secret',
	'apikey',
	'credential',
	'signature',
	'cookie',
	'session',
	'jwt'
];

/** A JSON Web Token: three base64url parts, the first one an encoded `{"`. */
const JWT_PATTERN = /^eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*$/;

/** Splits a parameter name into lower-case words: `where[accessToken]` is `where`, `access`, `token`. */
function parameterWords(name: string): string[] {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

/**
 * Builds the predicate that decides whether a parameter's value is redacted.
 *
 * @param extraWords - Words to treat as sensitive on top of {@link DEFAULT_SENSITIVE_PARAMETER_WORDS}.
 */
export function createSensitiveParameterMatcher(extraWords: readonly string[] = []): (name: string) => boolean {
	const words = new Set([...DEFAULT_SENSITIVE_PARAMETER_WORDS, ...extraWords.map((word) => word.toLowerCase())]);
	return (name: string): boolean => {
		const parts = parameterWords(name);
		const joined = parts.join('');
		return (
			parts.some((part) => words.has(part)) || SENSITIVE_FRAGMENTS.some((fragment) => joined.includes(fragment))
		);
	};
}

/**
 * `decodeURIComponent` that leaves a malformed sequence as it is instead of throwing. In a query string `+` is a
 * space; in a path it is a `+`, as the router decodes it.
 */
function safeDecode(value: string, plusIsSpace = false): string {
	try {
		return decodeURIComponent(plusIsSpace ? value.replace(/\+/g, ' ') : value);
	} catch {
		return value;
	}
}

function looksLikeJwt(value: string): boolean {
	return JWT_PATTERN.test(value);
}

/** One `key=value` pair of a query string, with the value redacted when the key or the value is sensitive. */
function redactQueryPair(pair: string, isSensitive: (name: string) => boolean): string {
	const separator = pair.indexOf('=');
	if (separator === -1) {
		return looksLikeJwt(safeDecode(pair, true)) ? REDACTED_VALUE : pair;
	}
	const key = pair.slice(0, separator);
	const value = pair.slice(separator + 1);
	return isSensitive(safeDecode(key, true)) || looksLikeJwt(safeDecode(value, true))
		? `${key}=${REDACTED_VALUE}`
		: pair;
}

export interface RedactRequestUrlOptions {
	/** Decides whether a parameter name is sensitive; see {@link createSensitiveParameterMatcher}. */
	isSensitive: (name: string) => boolean;
	/**
	 * The route parameters the router matched (`req.params`): a path segment equal to the value of a sensitive
	 * one is redacted.
	 */
	params?: Record<string, unknown>;
	/** Defaults to {@link MAX_LOGGED_URL_LENGTH}. */
	maxLength?: number;
}

/**
 * The URL with every sensitive value replaced by {@link REDACTED_VALUE}.
 *
 * @param url - The request URL as received (`req.originalUrl`): path and query string, percent-encoded.
 */
export function redactRequestUrl(
	url: string,
	{ isSensitive, params, maxLength = MAX_LOGGED_URL_LENGTH }: RedactRequestUrlOptions
): string {
	const queryStart = url.indexOf('?');
	const path = queryStart === -1 ? url : url.slice(0, queryStart);
	const query = queryStart === -1 ? undefined : url.slice(queryStart + 1);

	const sensitiveSegments = new Set(
		Object.entries(params ?? {})
			.filter(([name, value]) => typeof value === 'string' && value !== '' && isSensitive(name))
			.map(([, value]) => value as string)
	);
	const redactedPath = path
		.split('/')
		.map((segment) => {
			const decoded = safeDecode(segment);
			return sensitiveSegments.has(decoded) || looksLikeJwt(decoded) ? REDACTED_VALUE : segment;
		})
		.join('/');

	const redactedQuery =
		query === undefined
			? ''
			: `?${query
					.split('&')
					.map((pair) => redactQueryPair(pair, isSensitive))
					.join('&')}`;

	const redacted = redactedPath + redactedQuery;
	return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}
