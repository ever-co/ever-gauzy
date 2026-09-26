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
 * The answer is deliberately "HTTP unless the host says otherwise". A host that reports a type other
 * than `http` has no HTTP reply to write, and a host that cannot answer at all is treated as HTTP,
 * which is the behaviour every caller had before this check existed. The opposite default would turn
 * a host that merely does not implement `getType` into a rethrow — silently changing what an error
 * response is, in the one place that decides it.
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
		const type = host?.getType?.();
		return type === undefined || type === 'http';
	} catch {
		// A host whose `getType` throws is no more informative than one that lacks it.
		return true;
	}
}
