import { ArgumentsHost } from '@nestjs/common';

/**
 * Whether this invocation is an HTTP one.
 *
 * A filter that renders a reply has to know. Nest consults the global filters for every execution
 * context — an HTTP route, a GraphQL operation, a socket message — and a filter that writes an HTTP
 * response must stay out of the contexts that have none. On a GraphQL operation the host's response
 * object is the GraphQL context, so `response.status(...)` does not exist, and reaching for it
 * replaces the caller's own failure with `response.status is not a function`: an error about the
 * error path, with the original exception lost behind it.
 *
 * The check is written against `getType()` returning something *other* than `'http'` rather than
 * against `'graphql'` exactly. A context this code has never heard of has no HTTP response either,
 * and assuming one is precisely what produces the crash this guards.
 *
 * It lives in its own module because both global filters need it and one of them is the other's
 * delegate — a shared helper imported by both keeps that relationship a delegation rather than a
 * cycle.
 *
 * @param host - The arguments host for the current context.
 * @returns True when the context has an HTTP request and response.
 */
export function isHttpHost(host: ArgumentsHost): boolean {
	try {
		return host.getType<'http' | 'graphql' | 'rpc' | 'ws'>() === 'http';
	} catch {
		// A host that cannot say what it is has no HTTP response to write to.
		return false;
	}
}
