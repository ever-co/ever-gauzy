import { parseToBoolean } from '@gauzy/utils';

/** Injection token of the resolved {@link HttpRequestLoggerOptions}. */
export const HTTP_REQUEST_LOGGER_OPTIONS = 'HTTP_REQUEST_LOGGER_OPTIONS';

/** How the HTTP request log behaves. Every field has a default; see {@link resolveHttpRequestLoggerOptions}. */
export interface HttpRequestLoggerOptions {
	/** Whether requests are logged at all. Default: `LOG_HTTP_REQUESTS`, off unless it is `true`. */
	enabled: boolean;
	/** The logger context every line carries. Default: `HttpRequest`. */
	context: string;
	/**
	 * Path prefixes that are never logged, matched on whole segments with the query string ignored. Default: the
	 * health checks (`/api/health`), which Kubernetes probes every few seconds on every pod.
	 */
	ignorePaths: readonly string[];
	/**
	 * Parameter-name words whose values are redacted, on top of `DEFAULT_SENSITIVE_PARAMETER_WORDS`
	 * (see `redact-request-url.ts`). Values can only be hidden by this, never revealed.
	 */
	redactParameters: readonly string[];
	/**
	 * The response header the request id is read from. Default: `x-correlation-id`, which `RequestContextMiddleware`
	 * sets on every API response (the caller's own id when it sent a valid one, a generated UUID otherwise).
	 */
	requestIdHeader: string;
}

/**
 * The options in effect: the defaults, `LOG_HTTP_REQUESTS` from the environment, then `overrides`.
 *
 * @param overrides - What a caller of `HttpRequestLoggerModule.forRoot()` sets explicitly.
 * @param env - Defaults to `process.env`.
 */
export function resolveHttpRequestLoggerOptions(
	overrides: Partial<HttpRequestLoggerOptions> = {},
	env: NodeJS.ProcessEnv = process.env
): HttpRequestLoggerOptions {
	const defined = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
	return {
		enabled: parseToBoolean(env.LOG_HTTP_REQUESTS),
		context: 'HttpRequest',
		ignorePaths: ['/api/health'],
		redactParameters: [],
		requestIdHeader: 'x-correlation-id',
		...defined
	};
}
