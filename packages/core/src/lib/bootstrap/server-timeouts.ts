/**
 * Keep-alive timing of the API's HTTP server behind a reverse proxy.
 *
 * nginx (and the ingress controllers built on it) keeps idle upstream connections open and reuses them
 * for later requests, for `keepalive_timeout` (60 s by default). Node closes an idle keep-alive socket
 * after `server.keepAliveTimeout`, which defaults to 5 s. When Node closes a socket at the very moment
 * nginx picks it for the next request, nginx gets a reset and answers that request with a 502 — sporadic
 * 502s that no log on the API side explains. The upstream must outlive the proxy's idle timeout, so the
 * proxy is always the side that closes an idle connection.
 *
 * `headersTimeout` is kept above `keepAliveTimeout` (the long-standing Node guidance, nodejs/node#27363):
 * otherwise a connection that sat idle close to the keep-alive limit can be cut by the headers timer
 * while its next request is arriving.
 */

/**
 * Default `keepAliveTimeout`, in milliseconds: above nginx's 60 s default upstream `keepalive_timeout`.
 * Override with `API_KEEP_ALIVE_TIMEOUT_MS` when the proxy in front of the API keeps idle upstream
 * connections longer than that.
 */
export const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 65_000;

/** How much longer than `keepAliveTimeout` the headers timeout is. */
const HEADERS_TIMEOUT_MARGIN_MS = 1_000;

/** The two `http.Server` settings this configures. */
export interface KeepAliveTimeouts {
	keepAliveTimeout: number;
	headersTimeout: number;
}

/**
 * Resolves the keep-alive timeout from its environment value.
 *
 * @param raw - The raw `API_KEEP_ALIVE_TIMEOUT_MS` value.
 * @returns A positive whole number of milliseconds; {@link DEFAULT_KEEP_ALIVE_TIMEOUT_MS} when the value is
 * unset, or invalid (which is reported, not fatal: a typo must not stop the API from starting).
 */
export function resolveKeepAliveTimeout(raw?: string): number {
	const value = (raw ?? '').trim();
	if (!value) {
		return DEFAULT_KEEP_ALIVE_TIMEOUT_MS;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		console.warn(
			`⚠️ Ignoring invalid API_KEEP_ALIVE_TIMEOUT_MS "${raw}" — expected a positive whole number of milliseconds. ` +
				`Using ${DEFAULT_KEEP_ALIVE_TIMEOUT_MS}.`
		);
		return DEFAULT_KEEP_ALIVE_TIMEOUT_MS;
	}
	return parsed;
}

/**
 * Applies the keep-alive and headers timeouts to the API's HTTP server.
 *
 * @param server - The Node HTTP server (`app.getHttpServer()`).
 * @param keepAliveTimeoutMs - How long an idle keep-alive connection stays open.
 * @returns The values that were applied.
 */
export function applyKeepAliveTimeouts(server: KeepAliveTimeouts, keepAliveTimeoutMs: number): KeepAliveTimeouts {
	server.keepAliveTimeout = keepAliveTimeoutMs;
	server.headersTimeout = keepAliveTimeoutMs + HEADERS_TIMEOUT_MARGIN_MS;
	return { keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout };
}
