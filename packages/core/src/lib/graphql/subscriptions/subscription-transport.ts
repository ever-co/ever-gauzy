import { ApolloDriverConfig } from '@nestjs/apollo';
import { DocumentNode, GraphQLError, GraphQLSchema, ValidationRule, specifiedRules, validate } from 'graphql';
import type { CreateGraphqlRequestContextOptions } from '../graphql-context';

/**
 * The transport package the sub-protocol needs.
 */
export const GRAPHQL_SUBSCRIPTION_TRANSPORT_PACKAGE = 'graphql-ws';

/**
 * The module resolver, declared locally so this file compiles whether or not the ambient Node types
 * are in scope. The API is built as CommonJS, which is where `require` comes from.
 */
declare const require: { resolve(id: string): string };

/**
 * The connection parameters a client may present a credential in.
 *
 * A browser `WebSocket` cannot set a request header — the constructor has no place to put one — so
 * `graphql-ws` carries the credential in the `connection_init` payload instead. These are the names the
 * platform's HTTP surface already authenticates with (`Authorization` for a bearer token, `X-APP-ID`
 * with `X-API-KEY` for a key pair), spelled as a client would write them in that payload; each is
 * mapped onto the header of the same name so one credential resolver serves both transports rather
 * than two that can disagree.
 */
export const SUBSCRIPTION_CREDENTIAL_PARAMS = ['authorization', 'x-app-id', 'x-api-key'] as const;

/**
 * The scope parameters a connection may state alongside its credential.
 *
 * They are read for the reason the HTTP surface reads them: a client states which channel it acts on,
 * and `TenantBaseGuard` compares a stated `Tenant-Id` with the authenticated tenant. They are
 * statements, never sources — the operation's tenant and organization come from the credential — so
 * accepting them here cannot widen a connection's scope.
 */
export const SUBSCRIPTION_SCOPE_PARAMS = ['tenant-id', 'organization-id', 'x-channel-id', 'language'] as const;

/**
 * Where the normalised headers of a connection are kept on the connection's `extra`.
 */
export const SUBSCRIPTION_HEADERS_KEY = '__gauzySubscriptionHeaders';

/** Every parameter name a connection may present, as a set for the lookup below. */
const KNOWN_SUBSCRIPTION_PARAMS = new Set<string>([...SUBSCRIPTION_CREDENTIAL_PARAMS, ...SUBSCRIPTION_SCOPE_PARAMS]);

/**
 * What the transport is given at boot.
 */
export interface SubscriptionTransportOptions {
	/**
	 * The validation rules the HTTP transport applies on top of the specification's own: the
	 * introspection policy and the depth, cost and alias ceilings.
	 */
	readonly validationRules?: readonly ValidationRule[];
}

/**
 * The shape of a graphql-ws connection context, as far as this file reads it.
 */
interface SubscriptionConnectionContext {
	readonly connectionParams?: Record<string, unknown>;
	readonly extra?: Record<string, unknown> & { request?: { headers?: Record<string, unknown> } };
}

/**
 * Whether the WebSocket sub-protocol can be enabled.
 *
 * The transport is a separate package and it is optional: an installation that has not installed it
 * serves queries and mutations exactly as before, and one that has gets subscriptions on the same
 * endpoint. The probe happens at boot and answers from what is actually installed, so a deployment
 * never has to keep a flag in step with its lockfile — and, more importantly, a missing optional
 * package can never stop the API from starting.
 *
 * @returns True when the driver can be told to serve subscriptions.
 */
export function supportsSubscriptionTransport(): boolean {
	try {
		require.resolve(GRAPHQL_SUBSCRIPTION_TRANSPORT_PACKAGE);
		return true;
	} catch {
		return false;
	}
}

/**
 * The driver options that turn on subscriptions on the one GraphQL endpoint.
 *
 * The sub-protocol rides the existing path — there is no second endpoint and no second
 * authorisation model. When the transport package is absent the key is omitted entirely, so the
 * driver is configured exactly as it is today.
 *
 * 🛑 **This used to be `{ subscriptions: { 'graphql-ws': true } }`, and the socket was not held to the
 * endpoint's rules.** Two things were missing, and both are added here:
 *
 *   - **No connection was refused.** `graphql-ws` acknowledges every `connection_init` unless an
 *     `onConnect` says otherwise, so an anonymous client held a socket open and could send operations
 *     on it. Every data field still refused it — the global `AuthGuard` and `TenantPermissionGuard`
 *     run on a socket operation too — but a socket is a resource, and one that can never be served
 *     should be closed at `connection_init` (`4403 Forbidden`) rather than refused field by field.
 *     The credential is only looked for here, not verified: verifying it is the guards' business, and
 *     doing it twice is the second authorisation model this design exists to avoid.
 *   - **The validation rules were the specification's alone.** The introspection policy and the
 *     depth, cost and alias ceilings are validation rules the HTTP server applies, and `graphql-ws`
 *     validates with `graphql`'s `specifiedRules` unless it is given a `validate`. A deployment that
 *     had switched introspection off still published its whole schema to anyone who sent
 *     `{ __schema { … } }` over the socket — introspection is answered by graphql-js itself, so no
 *     guard ever sees it. The socket now validates with the same rules the HTTP request does.
 *
 * `validate` is not in the subset of `graphql-ws` options `@nestjs/graphql` types, but it is passed
 * through: `GqlSubscriptionService` spreads the `graphql-ws` options into `useServer` verbatim, which is
 * what the cast below relies on and what the transport's spec exercises against `graphql-ws` itself.
 *
 * @param options The rules the socket is held to.
 * @returns The `subscriptions` option, or an empty object.
 */
export function subscriptionTransportOptions(
	options: SubscriptionTransportOptions = {}
): { subscriptions?: ApolloDriverConfig['subscriptions'] } {
	if (!supportsSubscriptionTransport()) {
		return {};
	}

	return {
		subscriptions: {
			'graphql-ws': createSubscriptionServerOptions(options)
		} as ApolloDriverConfig['subscriptions']
	};
}

/**
 * The `graphql-ws` server options themselves, apart from the package probe so a spec can hand them to
 * `graphql-ws` directly.
 *
 * @param options The rules the socket is held to.
 * @returns The options.
 */
export function createSubscriptionServerOptions(options: SubscriptionTransportOptions = {}): {
	onConnect: (context: unknown) => boolean;
	validate: (schema: GraphQLSchema, document: DocumentNode) => ReadonlyArray<GraphQLError>;
} {
	const rules = [...specifiedRules, ...(options.validationRules ?? [])];

	return {
		onConnect: (context: unknown) => acceptSubscriptionConnection(context),
		validate: (schema: GraphQLSchema, document: DocumentNode) => validate(schema, document, rules)
	};
}

/**
 * Reads a connection's parameters and decides whether the socket stays open.
 *
 * The normalised headers are kept on the connection's `extra`, which `graphql-ws` hands back with
 * every operation on that socket, so {@link graphqlContextArguments} does not read them again.
 *
 * @param context The graphql-ws connection context.
 * @returns True when the connection presented a credential.
 */
export function acceptSubscriptionConnection(context: unknown): boolean {
	const connection = context as SubscriptionConnectionContext | undefined;
	const headers = subscriptionConnectionHeaders(connection?.connectionParams, connection?.extra?.request?.headers);

	if (connection?.extra) {
		connection.extra[SUBSCRIPTION_HEADERS_KEY] = headers;
	}

	return presentsCredential(headers);
}

/**
 * Whether a header bag carries something the platform can authenticate: a bearer token, or a complete
 * key pair. Half a key pair is not a credential — `ApiKeyAuthGuard` refuses it — so it does not keep a
 * socket open either.
 *
 * @param headers The normalised headers.
 * @returns True when a credential is present.
 */
function presentsCredential(headers: Record<string, string>): boolean {
	return Boolean(headers['authorization']) || (Boolean(headers['x-app-id']) && Boolean(headers['x-api-key']));
}

/**
 * Folds a connection's parameters and its upgrade request's headers into one lower-cased bag.
 *
 * The upgrade request is read *underneath* the parameters rather than instead of them: a non-browser
 * client — a server-to-server consumer, a test — really can set an `Authorization` header on the
 * upgrade, and a browser client cannot, so both are accepted and the explicit parameter wins. Only the
 * names above are read, so a connection cannot smuggle an arbitrary header into the request the guards
 * see.
 *
 * @param params The `connection_init` payload.
 * @param upgradeHeaders The headers of the HTTP request the socket was upgraded from.
 * @returns The headers, lower-cased.
 */
export function subscriptionConnectionHeaders(
	params?: Record<string, unknown>,
	upgradeHeaders?: Record<string, unknown>
): Record<string, string> {
	const headers: Record<string, string> = {};

	const absorb = (source?: Record<string, unknown>) => {
		if (!source || typeof source !== 'object') {
			return;
		}

		for (const [key, value] of Object.entries(source)) {
			const name = key.toLowerCase();

			if (!KNOWN_SUBSCRIPTION_PARAMS.has(name)) {
				continue;
			}

			const text = Array.isArray(value) ? value[0] : value;

			if (typeof text === 'string' && text.length > 0) {
				headers[name] = text;
			}
		}
	};

	absorb(upgradeHeaders);
	absorb(params);

	return headers;
}

/**
 * The arguments `createGraphqlRequestContext` should be called with, for either transport.
 *
 * The driver calls its `context` factory with `{ req, res }` for a query or a mutation and with the
 * graphql-ws connection context for a socket operation. Reading only `req` — which is what the
 * configuration did — built a socket operation's context with no request at all, and the driver then
 * put the connection context itself where the request goes: the `AuthGuard` asked it for
 * `headers.authorization`, found no `headers`, and every socket operation failed with a `TypeError`
 * reported as `INTERNAL_ERROR` instead of being authenticated or refused.
 *
 * A socket operation now gets a request whose headers are the connection's credential and scope, so
 * the guards authenticate it with the resolver they use for HTTP. What that cannot do from here is
 * give the operation the request-context store `RequestContext` reads: that store is opened by
 * `RequestContextMiddleware`, an HTTP middleware that never runs for a socket, so
 * `TenantPermissionGuard` still finds no tenant and refuses. Opening that store around a socket
 * operation belongs in `core/context/`, beside the middleware.
 *
 * @param source Whatever the driver handed the context factory.
 * @returns The request, and the headers to read the channel from.
 */
export function graphqlContextArguments(source: unknown): CreateGraphqlRequestContextOptions {
	const context = source as (SubscriptionConnectionContext & { req?: unknown }) | undefined;

	if (context?.req) {
		return { req: context.req };
	}

	if (context && ('connectionParams' in context || 'extra' in context)) {
		const headers =
			(context.extra?.[SUBSCRIPTION_HEADERS_KEY] as Record<string, string> | undefined) ??
			subscriptionConnectionHeaders(context.connectionParams, context.extra?.request?.headers);

		return { req: subscriptionRequest(headers), headers };
	}

	return {};
}

/**
 * The request a socket operation is authenticated from.
 *
 * It carries the connection's headers and Express's two header accessors, because the guards read a
 * request both ways: `AuthGuard` through `headers.authorization`, `ApiKeyAuthGuard` through
 * `request.header('X-APP-ID')`.
 *
 * @param headers The connection's normalised headers.
 * @returns The request.
 */
function subscriptionRequest(headers: Record<string, string>): {
	headers: Record<string, string>;
	header: (name: string) => string | undefined;
	get: (name: string) => string | undefined;
} {
	const bag = { ...headers };
	const read = (name: string) => bag[String(name).toLowerCase()];

	return { headers: bag, header: read, get: read };
}
