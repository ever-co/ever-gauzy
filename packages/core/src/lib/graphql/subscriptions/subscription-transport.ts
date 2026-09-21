import { ApolloDriverConfig } from '@nestjs/apollo';
import { CreateGraphqlRequestContextOptions } from '../graphql-context';

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
 * `graphql-ws` carries the credential in the `connection_init` payload instead. These are the four
 * names the platform's REST surface already accepts, spelled as a client would write them in that
 * payload; each is mapped onto the header of the same name so one credential resolver serves both
 * transports rather than two that can disagree.
 */
export const SUBSCRIPTION_CREDENTIAL_PARAMS = ['authorization', 'x-auth-token', 'x-api-key', 'x-app-id'] as const;

/**
 * The scope parameters a connection may state alongside its credential.
 *
 * They are read for the same reason the HTTP surface reads them: a client states which channel it is
 * acting on. They are *assertions*, never sources — `createGraphqlRequestContext` refuses a tenant or
 * organization that contradicts the credential — so accepting them here cannot widen a connection's
 * scope.
 */
export const SUBSCRIPTION_SCOPE_PARAMS = ['tenant-id', 'organization-id', 'x-channel-id', 'language'] as const;

/**
 * What the transport was given at boot.
 */
export interface SubscriptionTransportOptions {
	/** The endpoint path the sub-protocol rides, so the WebSocket server listens where the schema is. */
	readonly path?: string;
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
 * The sub-protocol rides the existing path — there is no second endpoint and no second authorisation
 * model. When the transport package is absent the key is omitted entirely, so the driver is
 * configured exactly as it is today.
 *
 * 🛑 **This used to be `{ subscriptions: { 'graphql-ws': true } }`, and the docstring's claim about
 * one authorisation model was true only because there was none on this path.** A browser WebSocket
 * cannot send an `Authorization` header, so a credential arrives in `connectionParams` — and nothing
 * read `connectionParams`. The context factory the driver was given reads HTTP headers, so a
 * subscription operation arrived with no credential, no tenant and no scope of any kind, and every
 * `@Subscription` field in the platform sits under `TenantPermissionGuard`, which returns false when
 * `RequestContext.currentTenantId()` is undefined. Every subscription was refused for every caller,
 * authenticated or not; and where a guard was bypassed, the payload filters compare
 * `payload.tenantId === RequestContext.currentTenantId()` and dropped every event instead.
 *
 * Two things are supplied now, and both are additive:
 *
 *   - **`onConnect`** refuses a connection that presents no credential at all, so an unauthenticated
 *     socket is closed at `connection_init` rather than kept open to be refused field by field, and
 *     normalises the parameters it did present into a header bag on `ctx.extra`.
 *   - **{@link graphqlContextArguments}**, used by the driver's `context` factory, reads that bag, so
 *     a subscription operation builds the same `GraphqlRequestContext` an HTTP operation does — same
 *     tenant resolution, same refusal of a header that contradicts the credential, same per-operation
 *     loader registry.
 *
 * What this cannot do from here is populate the CLS store `RequestContext` reads: that store is
 * established by `RequestContextMiddleware`, an HTTP `NestMiddleware` applied through
 * `configure(consumer)`, which never runs for a WebSocket operation. A `@Subscription` handler must
 * therefore take its scope from the GraphQL context rather than from `RequestContext` — which is what
 * `EventsResolver` does, and what any domain subscription should do — and the guards on those
 * handlers remain a second, stricter line that only an HTTP-backed connection satisfies. Closing that
 * gap properly means entering a CLS scope around a subscription's execution, which belongs in
 * `core/context/` beside the middleware rather than here.
 *
 * @param options The endpoint the sub-protocol should ride.
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
			'graphql-ws': {
				...(options.path ? { path: options.path } : {}),
				/**
				 * Accepts or refuses one connection.
				 *
				 * @param context The graphql-ws connection context.
				 * @returns False when the connection presented no credential, which closes the socket.
				 */
				onConnect: (context: unknown) => acceptSubscriptionConnection(context)
			}
		} as ApolloDriverConfig['subscriptions']
	};
}

/**
 * Reads a connection's parameters and decides whether the socket stays open.
 *
 * The credential itself is not verified here — that is the guards' and the resolvers' business, and
 * duplicating it would be the second authorisation model this design exists to avoid. What is done
 * here is the one thing only the transport can do: refuse a socket that presented nothing, so an
 * anonymous client is told at `connection_init` instead of holding a connection slot and being
 * refused on every field.
 *
 * The normalised headers are stashed on `ctx.extra` because that is the object the driver hands to
 * the context factory for a subscription operation.
 *
 * @param context The graphql-ws connection context.
 * @returns True when the connection may proceed.
 */
export function acceptSubscriptionConnection(context: unknown): boolean {
	const connection = context as
		| {
				connectionParams?: Record<string, unknown>;
				extra?: Record<string, unknown> & { request?: { headers?: Record<string, unknown> } };
		  }
		| undefined;

	const headers = subscriptionConnectionHeaders(connection?.connectionParams, connection?.extra?.request?.headers);

	if (connection?.extra) {
		connection.extra[SUBSCRIPTION_HEADERS_KEY] = headers;
	}

	return SUBSCRIPTION_CREDENTIAL_PARAMS.some((name) => typeof headers[name] === 'string' && headers[name] !== '');
}

/**
 * Where the normalised headers of a connection are kept on `ctx.extra`.
 */
export const SUBSCRIPTION_HEADERS_KEY = '__gauzySubscriptionHeaders';

/**
 * Folds a connection's parameters and its upgrade request's headers into one lower-cased bag.
 *
 * The upgrade request is read *underneath* the parameters rather than instead of them: a non-browser
 * client — a server-to-server consumer, a test — really can set an `Authorization` header on the
 * upgrade, and a browser client cannot, so both are accepted and the explicit parameter wins.
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
		for (const [key, value] of Object.entries(source ?? {})) {
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

/** Every parameter name a connection may present, as a set for the lookup above. */
const KNOWN_SUBSCRIPTION_PARAMS = new Set<string>([...SUBSCRIPTION_CREDENTIAL_PARAMS, ...SUBSCRIPTION_SCOPE_PARAMS]);

/**
 * The arguments `createGraphqlRequestContext` should be called with, for either transport.
 *
 * The driver calls its `context` factory with an HTTP request for a query or a mutation and with the
 * graphql-ws connection context for a subscription. Reading only `req` — which is what the
 * configuration did — meant a subscription operation built a context with no headers, no tenant and
 * no scope, so this normalises the two shapes into the one the factory takes.
 *
 * @param source Whatever the driver handed the context factory.
 * @returns The request and the headers to build the operation's context from.
 */
export function graphqlContextArguments(source: unknown): CreateGraphqlRequestContextOptions {
	const context = source as
		| {
				req?: unknown;
				request?: unknown;
				connectionParams?: Record<string, unknown>;
				extra?: Record<string, unknown> & { request?: { headers?: Record<string, unknown> } };
		  }
		| undefined;

	const req = context?.req ?? context?.extra?.request ?? context?.request;

	// A connection whose headers `onConnect` already normalised is the ordinary subscription path; the
	// two fallbacks cover a driver version that hands the parameters over without running `onConnect`
	// first, and a plain HTTP operation, which has none of this and falls through to `req.headers`.
	const stashed = context?.extra?.[SUBSCRIPTION_HEADERS_KEY] as Record<string, string> | undefined;

	if (stashed) {
		return { req, headers: stashed };
	}

	if (context?.connectionParams || context?.extra) {
		return {
			req,
			headers: subscriptionConnectionHeaders(context.connectionParams, context.extra?.request?.headers)
		};
	}

	return { req };
}
