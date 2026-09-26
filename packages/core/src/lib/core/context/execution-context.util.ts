import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Reading the request behind a handler, whichever surface it is running on.
 *
 * The HTTP accessor is not a safe assumption: a GraphQL root field is executed with the GraphQL
 * root, the arguments, the context and the field info in the argument positions the HTTP accessor
 * reads, so asking it for a request on a resolver hands back the GraphQL root object — or throws —
 * rather than an error a caller can act on. The platform's authenticated guards already branch on
 * the operation type; these helpers are the same branch, in one place, so a guard, an interceptor
 * and a resolver all reach the same object.
 */

/**
 * Reads the request behind a handler.
 *
 * @param context The execution context.
 * @returns The request, or undefined when the operation has none.
 */
export function executionRequest(context: ExecutionContext): any {
	const type = context.getType<'http' | 'graphql' | string>();

	if (type === 'graphql') {
		try {
			return GqlExecutionContext.create(context).getContext()?.req;
		} catch {
			return undefined;
		}
	}

	try {
		return context.switchToHttp().getRequest();
	} catch {
		return undefined;
	}
}

/**
 * Reads the response behind a handler.
 *
 * A GraphQL operation reaches the HTTP response through the context the platform builds, or through
 * the request Express attached it to.
 *
 * @param context The execution context.
 * @param request The already resolved request, used as the last resort.
 * @returns The response, or undefined when there is none to write to.
 */
export function executionResponse(context: ExecutionContext, request?: any): any {
	const type = context.getType<'http' | 'graphql' | string>();

	if (type === 'graphql') {
		try {
			const gqlContext = GqlExecutionContext.create(context).getContext();

			return gqlContext?.res ?? gqlContext?.req?.res ?? request?.res;
		} catch {
			return request?.res;
		}
	}

	try {
		return context.switchToHttp().getResponse();
	} catch {
		return request?.res;
	}
}

/**
 * Reads a header regardless of how the server cased it.
 *
 * A repeated header arrives as an array; the first value is the one addressed to this request.
 *
 * @param request The request.
 * @param name The lower-cased header name.
 * @returns The header value, or undefined.
 */
export function readRequestHeader(request: any, name: string): unknown {
	const headers = request?.headers;

	if (!headers) {
		return undefined;
	}

	if (headers[name] !== undefined) {
		return headers[name];
	}

	const match = Object.keys(headers).find((key) => key.toLowerCase() === name);

	return match ? headers[match] : undefined;
}

/**
 * Sets a response header when the surface has a response to set it on.
 *
 * @param response The response.
 * @param name The header name.
 * @param value The header value.
 */
export function setResponseHeader(response: any, name: string, value: string): void {
	if (response && typeof response.setHeader === 'function') {
		response.setHeader(name, value);
	}
}
