import { RequestContext } from '../core/context/request-context';
import { RelationLoaderRegistry } from './batch/relation-loader.registry';

/**
 * What a resolver receives as its GraphQL context.
 *
 * The context is the request scope. Apollo creates it once per operation, every resolver in that
 * operation sees the same object, and it is discarded when the operation ends — which is precisely
 * the lifetime a batch loader needs and the lifetime a cache must not exceed.
 *
 * `req` stays on the context because the guards read it: `TenantBaseGuard`, `AuthGuard` and
 * `ApiKeyAuthGuard` already resolve the request from a GraphQL execution context, and a resolver
 * that needs a header reads it from there rather than reaching for a global.
 */
export interface GraphqlRequestContext {
	/** The HTTP request the operation arrived on. */
	readonly req?: unknown;
	/** The relation loaders of this operation. */
	readonly loaders: RelationLoaderRegistry;
	/** The correlation id an operator can quote in a support ticket. */
	readonly traceId?: string;
	/** The tenant the caller is acting in, taken from the credential. */
	readonly tenantId?: string;
	/** The organization the caller is acting in, when it is scoped to one. */
	readonly organizationId?: string;
	/** The channel the operation acts on, when it is channel scoped. */
	readonly channelId?: string;
}

/**
 * How a context is built.
 */
export interface CreateGraphqlRequestContextOptions {
	/** The HTTP request the operation arrived on. */
	readonly req?: unknown;
	/** A registry to use instead of a fresh one, for a test or a caller that shares one deliberately. */
	readonly loaders?: RelationLoaderRegistry;
	/** Headers to read the scope from, when the request does not carry them. */
	readonly headers?: Record<string, string | string[] | undefined>;
	/** The trace id, when the caller already resolved one. */
	readonly traceId?: string;
	/** The tenant, when the caller already resolved one. */
	readonly tenantId?: string;
	/** The organization, when the caller already resolved one. */
	readonly organizationId?: string;
	/** The channel, when the caller already resolved one. */
	readonly channelId?: string;
}

/**
 * Builds the context of one GraphQL operation.
 *
 * Every operation gets its own loader registry, so a value batched and cached for one caller is
 * invisible to the next request. Sharing a registry across requests is the one mistake this factory
 * exists to make impossible in the ordinary path: the driver calls it per operation.
 *
 * @param options The request and any scope the caller resolved itself.
 * @returns The context.
 */
export function createGraphqlRequestContext(
	options: CreateGraphqlRequestContextOptions = {}
): GraphqlRequestContext {
	const headers = options.headers ?? readHeaders(options.req);

	return {
		req: options.req,
		loaders: options.loaders ?? new RelationLoaderRegistry(),
		traceId: options.traceId ?? resolveRequestTraceId(),
		tenantId: options.tenantId ?? readHeader(headers, 'tenant-id') ?? resolveRequestTenantId(),
		organizationId: options.organizationId ?? readHeader(headers, 'organization-id') ?? resolveRequestOrganizationId(),
		channelId: options.channelId ?? readHeader(headers, 'x-channel-id')
	};
}

/**
 * The id an operator should quote when they report a problem.
 *
 * Tracing supplies a trace id when it is on; otherwise the request's correlation id is the value
 * that ties a report to a log line. The two are read in that order so this is the same id the error
 * contract puts in `extensions.traceId`.
 *
 * @returns The trace id, when there is one.
 */
export function resolveRequestTraceId(): string | undefined {
	const extended = RequestContext as unknown as {
		currentTraceId?: () => string | undefined;
		getContextId?: () => string | undefined;
	};

	try {
		// Tracing is optional in this deployment, so its accessor is looked up rather than required:
		// a process with tracing off falls back to the correlation id instead of failing to start.
		if (typeof extended.currentTraceId === 'function') {
			return extended.currentTraceId() ?? undefined;
		}

		return typeof extended.getContextId === 'function' ? (extended.getContextId() as string | undefined) : undefined;
	} catch {
		// A GraphQL operation that arrived on a WebSocket has no CLS store; a missing correlation id
		// is not a reason to fail the operation.
		return undefined;
	}
}

/**
 * The tenant of the current operation, taken from the request context.
 *
 * @returns The tenant id, when there is one.
 */
export function resolveRequestTenantId(): string | undefined {
	return readRequestContextValue(() => RequestContext.currentTenantId() as string | undefined);
}

/**
 * The organization of the current operation, taken from the request context.
 *
 * @returns The organization id, when there is one.
 */
export function resolveRequestOrganizationId(): string | undefined {
	return readRequestContextValue(() => RequestContext.currentOrganizationId() as string | undefined);
}

/**
 * Reads one value from the request context, tolerating its absence.
 *
 * @param read The accessor.
 * @returns The value, or undefined when there is no context or the field is unset.
 */
function readRequestContextValue(read: () => string | undefined): string | undefined {
	try {
		return read() ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * The headers of a request, lower-cased.
 *
 * Node lower-cases header names on the way in, so both spellings of `Tenant-Id` collapse to one key;
 * the case-insensitive lookup below covers a request object built by a test or by another runtime.
 *
 * @param req The request.
 * @returns The headers, or an empty map.
 */
function readHeaders(req: unknown): Record<string, string | string[] | undefined> {
	const headers = (req as { headers?: Record<string, string | string[] | undefined> } | undefined)?.headers;
	return headers && typeof headers === 'object' ? headers : {};
}

/**
 * Reads one header.
 *
 * @param headers The headers.
 * @param name The lower-cased header name.
 * @returns The first value, when present.
 */
function readHeader(
	headers: Record<string, string | string[] | undefined>,
	name: string
): string | undefined {
	const direct = headers[name];
	if (direct !== undefined) {
		return Array.isArray(direct) ? direct[0] : direct;
	}

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === name) {
			return Array.isArray(value) ? value[0] : value;
		}
	}

	return undefined;
}
