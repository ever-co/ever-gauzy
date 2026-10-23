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
	/**
	 * The tenant the caller is acting in, taken from the credential — never from a `Tenant-Id` header.
	 * See {@link createGraphqlRequestContext} for why, and for when it is read.
	 */
	readonly tenantId?: string;
	/** The organization the caller is acting in, when it is scoped to one, taken from the credential. */
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
	/**
	 * Headers to read the channel from, when the request does not carry them — a subscription's
	 * connection parameters. The tenant and the organization are never read from here.
	 */
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
 * 🛑 **The credential decides the scope; a header never does.** This used to resolve
 * `tenantId: options.tenantId ?? readHeader(headers, 'tenant-id') ?? resolveRequestTenantId()`, with the
 * credential last — and in practice not at all, because this factory runs *before* the operation
 * executes, while `req.user` is only attached by the `AuthGuard` that runs inside each resolver. So on
 * the HTTP path `tenantId` and `organizationId` were whatever the caller wrote in `Tenant-Id` and
 * `Organization-Id` (both are in the endpoint's CORS `allowedHeaders`), and on a request without them
 * they were undefined. Nothing reads the two members yet, which is the only reason this was latent
 * rather than a cross-tenant read: the `RelationLoaderRegistry` contract asks a batch function to be
 * scoped to the caller's tenant, and a loader taking that scope from the context would have taken it
 * from the header.
 *
 * Both are now read from the credential, and read *when they are asked for* rather than when the
 * context is built, so a resolver sees the tenant its guards authenticated. A header that contradicts
 * the credential is not this factory's to refuse: `TenantBaseGuard`, which `TenantPermissionGuard`
 * extends, already compares `Tenant-Id` with the authenticated tenant on every field it guards and
 * refuses a mismatch, and a context that threw here would have no credential to compare against yet.
 *
 * @param options The request and any scope the caller resolved itself.
 * @returns The context.
 */
export function createGraphqlRequestContext(
	options: CreateGraphqlRequestContextOptions = {}
): GraphqlRequestContext {
	const headers = options.headers ?? readHeaders(options.req);

	return new OperationContext({
		req: options.req,
		loaders: options.loaders ?? new RelationLoaderRegistry(),
		traceId: options.traceId ?? resolveRequestTraceId(),
		channelId: options.channelId ?? readHeader(headers, 'x-channel-id'),
		statedTenantId: options.tenantId,
		statedOrganizationId: options.organizationId
	});
}

/**
 * The context object itself.
 *
 * A class rather than a literal because the scope has to be read late, and the getters that read it
 * must live on the **prototype**. Apollo does not hand a resolver the object the factory returned: it
 * hands every operation `Object.assign(Object.create(Object.getPrototypeOf(context)), context)`
 * (`cloneObject` in `@apollo/server`), and `Object.assign` evaluates an own getter once, at clone
 * time — before any guard ran — and stores the answer as a plain value. A getter on the prototype is
 * not copied, so the clone keeps reading the credential when it is asked.
 */
class OperationContext implements GraphqlRequestContext {
	readonly req?: unknown;
	readonly loaders: RelationLoaderRegistry;
	readonly traceId?: string;
	readonly channelId?: string;
	/** A tenant the caller of the factory resolved itself, which wins over the credential lookup. */
	readonly statedTenantId?: string;
	/** An organization the caller of the factory resolved itself. */
	readonly statedOrganizationId?: string;

	constructor(members: {
		req?: unknown;
		loaders: RelationLoaderRegistry;
		traceId?: string;
		channelId?: string;
		statedTenantId?: string;
		statedOrganizationId?: string;
	}) {
		this.req = members.req;
		this.loaders = members.loaders;
		this.traceId = members.traceId;
		this.channelId = members.channelId;
		this.statedTenantId = members.statedTenantId;
		this.statedOrganizationId = members.statedOrganizationId;
	}

	get tenantId(): string | undefined {
		return this.statedTenantId ?? resolveRequestTenantId();
	}

	get organizationId(): string | undefined {
		return this.statedOrganizationId ?? resolveRequestOrganizationId();
	}
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
