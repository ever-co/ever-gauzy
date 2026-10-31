/**
 * Making a request URL safe to write to a log.
 *
 * A URL is the one part of a request the HTTP request log writes, and it can carry secrets in two places: the
 * query string (`?token=…`, `?code=…&state=…` on an OAuth callback, `?email=…`) and route parameters
 * (`/public/invoice/:id/:token`, `/shared-entity/token/:token`). Both are redacted by parameter NAME, and so is a
 * JSON query value (`?data={"findInput":{"email":…}}`) that holds a sensitive field, or a URL query value
 * (`?redirect=/shared-entity/token/…`) with something to redact in it. A value that is or holds a JWT, or looks like
 * an email address, is redacted wherever it appears, whatever its name.
 *
 * Route parameter names are only known once the router has matched the request. So a segment that follows a
 * segment such as `token` (`/token/<value>`) is redacted as well, and so is a long random-looking segment that no
 * matched route parameter accounts for: that covers a URL logged before routing, and a request no route matched
 * (a 404, or a client that gave up early). Everything else is kept as it was received (still percent-encoded), so
 * a line can neither be split by a decoded newline nor lose information a developer needs.
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
	'email',
	// OAuth callbacks: `state` authenticates the callback, `oauth_verifier` / `code_verifier` complete the exchange.
	'state',
	'verifier',
	'nonce',
	'ticket',
	// A one-time sign-in handoff code, as the Sentry request redaction lists it.
	'handoff'
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
	'jwt',
	'verifier'
];

/**
 * Path segments, compared whole and case-insensitively, after which the next segment is a secret
 * (`/shared-entity/token/<token>`). Deliberately narrow: `auth` or `code` here would hide `/auth/login` or a plan code.
 */
const SENSITIVE_PATH_KEYWORDS: ReadonlySet<string> = new Set([
	'token',
	'tokens',
	'secret',
	'password',
	'apikey',
	'api-key',
	'signature',
	'otp'
]);

/**
 * A JSON Web Token, alone or inside a longer value (a `/public/invoice/42/<jwt>` link passed on as a redirect): three
 * base64url parts, the first one an encoded `{"`.
 */
const JWT_PATTERN = /(?:^|[^\w-])eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/;

/** A character that can end the local part of an email address (the one before the `@`). */
const EMAIL_LOCAL_CHARACTER = /[\w.!#$%&'*+=?^`{|}~-]/;

/**
 * The domain of an email address, matched from just after an `@` (sticky). Labels exclude the characters that
 * separate addresses in a list or text, and matching them label by label keeps the scan linear.
 */
const EMAIL_DOMAIN = /[^\s@.,;:<>()[\]"'\\/?#&=]+(?:\.[^\s@.,;:<>()[\]"'\\/?#&=]+)+/y;

/** A UUID, the shape of every entity id in the API: an id is not a secret, and it is what makes a line useful. */
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** The shortest segment {@link looksLikeOpaqueToken} treats as a token: 12 random bytes, hex-encoded. */
const MIN_OPAQUE_TOKEN_LENGTH = 24;

/**
 * How deep a query value is looked into: JSON nesting and URLs inside it (`?redirect=/a?next=/b…`,
 * `?data={"redirect":"/…"}`) share this budget, and a value nested deeper is redacted.
 */
const MAX_VALUE_DEPTH = 32;

type IsSensitive = (name: string) => boolean;

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

/** Whether a value holds an email address anywhere: alone, in text, or in a list of addresses. */
function containsEmail(value: string): boolean {
	for (let at = value.indexOf('@'); at !== -1; at = value.indexOf('@', at + 1)) {
		if (at > 0 && EMAIL_LOCAL_CHARACTER.test(value[at - 1])) {
			EMAIL_DOMAIN.lastIndex = at + 1;
			if (EMAIL_DOMAIN.test(value)) {
				return true;
			}
		}
	}
	return false;
}

/** A value that is sensitive whatever its name or place: one that is or holds a JWT or an email address. */
function isSensitiveValue(value: string): boolean {
	return JWT_PATTERN.test(value) || containsEmail(value);
}

/**
 * A path segment that looks like a random token: long, made of URL-safe token characters, with both letters and
 * digits, and not a UUID. Only applied to segments no matched route parameter accounts for (see the file comment):
 * a route's own text and the ids it matched are kept.
 */
function looksLikeOpaqueToken(value: string): boolean {
	return (
		value.length >= MIN_OPAQUE_TOKEN_LENGTH &&
		/^[\w~.+/=-]+$/.test(value) &&
		/\d/.test(value) &&
		/[a-z]/i.test(value) &&
		!UUID_PATTERN.test(value)
	);
}

/**
 * Whether a parsed JSON value has a sensitive field name anywhere inside it, or a string that is sensitive as a
 * query value would be (a JWT, an email address, a URL with something to redact in it).
 */
function holdsSensitiveData(value: unknown, isSensitive: IsSensitive, depth: number): boolean {
	if (depth > MAX_VALUE_DEPTH) {
		return true;
	}
	if (typeof value === 'string') {
		return isSensitiveQueryValue(value, isSensitive, depth + 1);
	}
	if (Array.isArray(value)) {
		return value.some((item) => holdsSensitiveData(item, isSensitive, depth + 1));
	}
	if (value !== null && typeof value === 'object') {
		return Object.entries(value).some(
			([name, item]) => isSensitive(name) || holdsSensitiveData(item, isSensitive, depth + 1)
		);
	}
	return false;
}

/**
 * The path and query of a URL carried in a query value (`?redirect=/public/…`, `?next=https://host/…`), or
 * `undefined` for any other value. A fragment (`#access_token=…` on an OAuth redirect) is read as query parameters.
 */
function nestedUrl(value: string): string | undefined {
	const origin = /^https?:\/\/[^/?#]*/i.exec(value);
	const pathAndQuery = origin ? value.slice(origin[0].length) : value.startsWith('/') ? value : undefined;
	return pathAndQuery?.replace('#', pathAndQuery.includes('?') ? '&' : '?');
}

/**
 * Whether a decoded query value must be hidden: a JWT, an email address, JSON (some endpoints take their filters as
 * `?data=<JSON>`) with a sensitive field, or a URL with something to redact in it. JSON that does not parse is
 * hidden, since it cannot be checked.
 */
function isSensitiveQueryValue(value: string, isSensitive: IsSensitive, depth: number): boolean {
	if (depth > MAX_VALUE_DEPTH || isSensitiveValue(value)) {
		return true;
	}
	const text = value.trim();
	if (text.startsWith('{') || text.startsWith('[')) {
		try {
			return holdsSensitiveData(JSON.parse(text), isSensitive, depth + 1);
		} catch {
			return true;
		}
	}
	const url = nestedUrl(text);
	return url !== undefined && redactPathAndQuery(url, isSensitive, undefined, depth + 1) !== url;
}

/** One `key=value` pair of a query string, with the value redacted when the key or the value is sensitive. */
function redactQueryPair(pair: string, isSensitive: IsSensitive, depth: number): string {
	const separator = pair.indexOf('=');
	if (separator === -1) {
		return isSensitiveQueryValue(safeDecode(pair, true), isSensitive, depth) ? REDACTED_VALUE : pair;
	}
	const key = pair.slice(0, separator);
	const value = pair.slice(separator + 1);
	return isSensitive(safeDecode(key, true)) || isSensitiveQueryValue(safeDecode(value, true), isSensitive, depth)
		? `${key}=${REDACTED_VALUE}`
		: pair;
}

/** The values of the matched route parameters: those of sensitive ones, and those of the rest. */
function routeParameterValues(
	params: Record<string, unknown> | undefined,
	isSensitive: IsSensitive
): { sensitive: Set<string>; accountedFor: Set<string> } {
	const sensitive = new Set<string>();
	const accountedFor = new Set<string>();
	for (const [name, value] of Object.entries(params ?? {})) {
		// A wildcard (`*path`) matches an array of segments. That says nothing about what they are (Nest's own
		// `{*splat}` middleware routes match every request this way), so they never count as accounted for.
		const values = Array.isArray(value) ? value : [value];
		const target = isSensitive(name) ? sensitive : Array.isArray(value) ? undefined : accountedFor;
		for (const item of values) {
			if (typeof item === 'string' && item !== '') {
				target?.add(item);
			}
		}
	}
	return { sensitive, accountedFor };
}

/** {@link redactRequestUrl} without the length cap; `depth` counts the values this URL is nested in. */
function redactPathAndQuery(
	url: string,
	isSensitive: IsSensitive,
	params: Record<string, unknown> | undefined,
	depth: number
): string {
	const queryStart = url.indexOf('?');
	const path = queryStart === -1 ? url : url.slice(0, queryStart);
	const query = queryStart === -1 ? undefined : url.slice(queryStart + 1);

	const { sensitive, accountedFor } = routeParameterValues(params, isSensitive);
	const segments = path.split('/');
	const redactedPath = segments
		.map((segment, index) => {
			if (segment === '') {
				return segment;
			}
			const decoded = safeDecode(segment);
			const afterKeyword =
				index > 0 && SENSITIVE_PATH_KEYWORDS.has(safeDecode(segments[index - 1]).toLowerCase());
			const redact =
				afterKeyword ||
				sensitive.has(decoded) ||
				isSensitiveValue(decoded) ||
				(looksLikeOpaqueToken(decoded) && !accountedFor.has(decoded));
			return redact ? REDACTED_VALUE : segment;
		})
		.join('/');

	if (query === undefined) {
		return redactedPath;
	}
	const redactedQuery = query
		.split('&')
		.map((pair) => redactQueryPair(pair, isSensitive, depth))
		.join('&');
	return `${redactedPath}?${redactedQuery}`;
}

export interface RedactRequestUrlOptions {
	/** Decides whether a parameter name is sensitive; see {@link createSensitiveParameterMatcher}. */
	isSensitive: IsSensitive;
	/**
	 * The route parameters the router matched (`req.params`): a path segment equal to the value of a sensitive
	 * one is redacted, and one equal to the value of another one is kept even when it looks like a token. Leave
	 * it out for a request that has not been routed yet.
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
	const redacted = redactPathAndQuery(url, isSensitive, params, 0);
	return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}
