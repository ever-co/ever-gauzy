import { ApolloDriverConfig } from '@nestjs/apollo';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import {
	DocumentNode,
	ExecutionArgs,
	GraphQLError,
	GraphQLSchema,
	ValidationRule,
	parse,
	specifiedRules,
	validate
} from 'graphql';
import * as passport from 'passport';
import { RequestContext } from '../../core/context/request-context';
import type { CreateGraphqlRequestContextOptions } from '../graphql-context';
import type { SubscriptionClock } from './subscription-delivery';
import { executeInRequestContext, subscribeInRequestContext } from './subscription-request-context';
import {
	SubscriptionCredentialAuthenticator,
	SubscriptionCredentialVerdict,
	SubscriptionSession,
	SubscriptionSessionUser,
	attachSubscriptionSession,
	bearerTokenExpiry
} from './subscription-session';

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

/**
 * Where the credential session of a connection (`SubscriptionSession`) is kept on the connection's `extra`.
 */
export const SUBSCRIPTION_SESSION_KEY = '__gauzySubscriptionSession';

/**
 * The passport strategy a connection's credential is judged again with: the one the global `AuthGuard`
 * authenticates every operation with (`PassportAuthGuard('jwt')`, served by `JwtStrategy`).
 */
export const SUBSCRIPTION_AUTH_STRATEGY = 'jwt';

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
	/**
	 * The token ceiling the HTTP transport's parser applies (`GRAPHQL_MAX_TOKENS`). A socket operation is parsed
	 * and validated before any guard runs, exactly like an HTTP request, so it is held to the same ceiling.
	 */
	readonly maxTokens?: number;
	/**
	 * How a connection's credential is judged again while its streams run. Defaults to
	 * {@link authenticateSubscriptionCredential}, the strategy an HTTP request is judged by.
	 */
	readonly authenticate?: SubscriptionCredentialAuthenticator;
	/**
	 * How often (ms) a connection's credential is judged again; `0` never (the token's expiry still closes the
	 * socket). Defaults to `GRAPHQL_SUBSCRIPTION_REAUTH_INTERVAL_MS` (see `resolveSubscriptionReauthIntervalMs`).
	 */
	readonly reauthenticationIntervalMs?: number;
	/** The clock the sessions' timers run on, for specs. */
	readonly clock?: SubscriptionClock;
}

/**
 * What a connection's credential session is built with: the part of {@link SubscriptionTransportOptions} it reads.
 */
export type SubscriptionSessionSettings = Pick<
	SubscriptionTransportOptions,
	'authenticate' | 'reauthenticationIntervalMs' | 'clock'
>;

/**
 * The shape of a graphql-ws connection context, as far as this file reads it.
 */
interface SubscriptionConnectionContext {
	readonly connectionParams?: Record<string, unknown>;
	readonly extra?: Record<string, unknown> & {
		request?: { headers?: Record<string, unknown> };
		/** The `ws` socket, under the `ws` adapter the driver serves the sub-protocol with. */
		socket?: { close?: (code?: number, reason?: string) => void };
	};
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
 *     The credential is only looked for here (and a bearer token's expiry read), not verified: verifying
 *     it is the guards' business, and doing it twice is the second authorisation model this design
 *     exists to avoid.
 *   - **The validation rules were the specification's alone.** The introspection policy and the
 *     depth, cost and alias ceilings are validation rules the HTTP server applies, and `graphql-ws`
 *     validates with `graphql`'s `specifiedRules` unless it is given a `validate`. A deployment that
 *     had switched introspection off still published its whole schema to anyone who sent
 *     `{ __schema { … } }` over the socket — introspection is answered by graphql-js itself, so no
 *     guard ever sees it. The socket now validates with the same rules the HTTP request does.
 *
 * 🛑 **An operation on the socket had no request context, so no subscription could ever be served.**
 * `RequestContext` is read from a CLS store that only `RequestContextMiddleware` opens, and that is
 * Express middleware: an operation arriving in a WebSocket message ran with no store at all.
 * `TenantPermissionGuard` found no tenant and refused every subscription, and the filter each
 * subscription screens its events with compared every event's tenant with null. `execute` and
 * `subscribe` are now `graphql`'s own, run inside a store of the operation's own holding a context
 * built from the operation's request (see `subscription-request-context.ts`), so the guards, the
 * credential and tenant and organization scoping behave as they do on HTTP.
 *
 * 🛑 **The credential was judged once, when an operation opened.** A subscription authenticated at
 * `subscribe` kept delivering after its access token expired and after its user, employee or membership was
 * deactivated, because nothing judged it again. Each accepted connection now has a `SubscriptionSession`:
 * the socket is closed when the token's `exp` passes (`4403`, which clients reconnect on with a fresh token),
 * and before an event is delivered the credential is judged again by the same strategy as an HTTP request,
 * at most once per `GRAPHQL_SUBSCRIPTION_REAUTH_INTERVAL_MS` (60 s) per connection — `4401` when it no longer
 * authenticates anybody, `4403` when the role, permissions or scope it resolves to changed. See
 * `subscription-session.ts`.
 *
 * `validate` is not in the subset of `graphql-ws` options `@nestjs/graphql` types, but it is passed
 * through: `GqlSubscriptionService` spreads the `graphql-ws` options into `useServer` verbatim, which is
 * what the cast below relies on and what the transport's spec exercises against `graphql-ws` itself.
 * The same spread is what lets `execute` and `subscribe` here replace the plain `graphql` functions
 * the service passes by default.
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
	onClose: (context: unknown) => void;
	onSubscribe: (context: unknown, id: string, payload: { query?: unknown }) => readonly GraphQLError[] | void;
	validate: (schema: GraphQLSchema, document: DocumentNode) => ReadonlyArray<GraphQLError>;
	execute: (args: ExecutionArgs) => ReturnType<typeof executeInRequestContext>;
	subscribe: (args: ExecutionArgs) => ReturnType<typeof subscribeInRequestContext>;
} {
	const rules = [...specifiedRules, ...(options.validationRules ?? [])];
	const session: SubscriptionSessionSettings = {
		authenticate: options.authenticate ?? authenticateSubscriptionCredential,
		reauthenticationIntervalMs: options.reauthenticationIntervalMs,
		clock: options.clock
	};

	return {
		onConnect: (context: unknown) => acceptSubscriptionConnection(context, session),
		// The socket went away (the client, a session check, the server): its expiry timer goes with it.
		onClose: (context: unknown) => subscriptionSessionOfConnection(context)?.dispose(),
		// Refuses an oversized document before graphql-ws parses and validates it (review on #10651): the socket
		// accepts a connection on the presence of a credential, and the guards authenticate it only when an operation
		// executes — so, as on HTTP, the parse and the quadratic validation are pre-authentication work.
		onSubscribe: (_context: unknown, _id: string, payload: { query?: unknown }) =>
			refuseOversizedDocument(payload?.query, options.maxTokens),
		validate: (schema: GraphQLSchema, document: DocumentNode) => validate(schema, document, rules),
		// Each operation runs inside a request context of its own, built from the request the context
		// factory gave it — the one the guards authenticate.
		execute: (args: ExecutionArgs) => executeInRequestContext(args),
		subscribe: (args: ExecutionArgs) => subscribeInRequestContext(args)
	};
}

/**
 * Refuses a document over the token ceiling, or answers nothing so graphql-ws goes on as it would.
 *
 * The document is parsed with the ceiling, which stops at it; a document under it is parsed again by graphql-ws,
 * which is bounded by the same ceiling.
 *
 * @param query The operation's document, as the client sent it.
 * @param maxTokens The ceiling; none means no refusal here.
 * @returns The refusal, or undefined.
 */
export function refuseOversizedDocument(query: unknown, maxTokens?: number): readonly GraphQLError[] | void {
	if (!maxTokens || typeof query !== 'string') {
		return undefined;
	}

	try {
		parse(query, { maxTokens });
		return undefined;
	} catch (error) {
		return error instanceof GraphQLError ? [error] : undefined;
	}
}

/**
 * Reads a connection's parameters and decides whether the socket stays open.
 *
 * The normalised headers are kept on the connection's `extra`, which `graphql-ws` hands back with
 * every operation on that socket, so {@link graphqlContextArguments} does not read them again.
 *
 * An accepted connection gets its credential session on the same `extra` (see `subscription-session.ts`),
 * which closes the socket when the bearer token's expiry passes and judges the credential again while its
 * streams deliver. The expiry is read from the token, not verified — the guards verify it — and a token
 * whose expiry has already passed is refused here (`4403`, which a client reconnects on with a fresh token)
 * rather than accepted only to have every operation refused.
 *
 * @param context The graphql-ws connection context.
 * @param settings How the connection's credential is judged again.
 * @returns True when the connection presented a credential that has not expired.
 */
export function acceptSubscriptionConnection(context: unknown, settings: SubscriptionSessionSettings = {}): boolean {
	const connection = context as SubscriptionConnectionContext | undefined;
	const headers = subscriptionConnectionHeaders(connection?.connectionParams, connection?.extra?.request?.headers);

	if (connection?.extra) {
		connection.extra[SUBSCRIPTION_HEADERS_KEY] = headers;
	}

	if (!presentsCredential(headers)) {
		return false;
	}

	const expiresAt = bearerTokenExpiry(headers['authorization']);
	const now = settings.clock?.now() ?? Date.now();

	if (expiresAt !== undefined && now >= expiresAt) {
		return false;
	}

	if (connection?.extra) {
		const socket = connection.extra.socket;

		connection.extra[SUBSCRIPTION_SESSION_KEY] = new SubscriptionSession({
			headers,
			close: (code, reason) => socket?.close?.(code, reason),
			authenticate: settings.authenticate,
			intervalMs: settings.reauthenticationIntervalMs,
			clock: settings.clock
		});
	}

	return true;
}

/**
 * The credential session of a connection, when it was accepted.
 *
 * @param context The graphql-ws connection context.
 * @returns The session, or undefined.
 */
export function subscriptionSessionOfConnection(context: unknown): SubscriptionSession | undefined {
	const session = (context as SubscriptionConnectionContext | undefined)?.extra?.[SUBSCRIPTION_SESSION_KEY];

	return session instanceof SubscriptionSession ? session : undefined;
}

/**
 * Judges a connection's credential again, exactly as an HTTP request carrying it would be judged.
 *
 * The platform's `jwt` passport strategy (`JwtStrategy`, which the global `AuthGuard` runs) is asked about
 * a request carrying the connection's headers, inside a request context of its own — the one
 * `RequestContextMiddleware` opens for an HTTP request, holding no user yet — so it verifies the signature
 * and the expiry and re-reads the user, the role and permissions they hold now, and the employee and the
 * membership the token names, through the same lookups and the same `JWT_AUTHENTICATED_USER_TTL_MS` reuse.
 * There is no second authorisation model: the answer is the HTTP answer.
 *
 * A database that could not be reached (`503`) and a strategy that could not run at all are answered
 * `unavailable`, never as a refusal: they say nothing about the user.
 *
 * @param headers The connection's normalised headers.
 * @returns The verdict.
 */
export function authenticateSubscriptionCredential(
	headers: Readonly<Record<string, string>>
): Promise<SubscriptionCredentialVerdict> {
	const req = subscriptionRequest({ ...headers });

	return RequestContext.runWithRequest(
		req as unknown as Request,
		() =>
			new Promise<SubscriptionCredentialVerdict>((resolve) => {
				const answer = (error: unknown, user: unknown, info: unknown): void => {
					if (error) {
						resolve(
							error instanceof HttpException && error.getStatus() !== HttpStatus.SERVICE_UNAVAILABLE
								? { status: 'refused' }
								: { status: 'unavailable' }
						);
					} else if (user && typeof user === 'object') {
						resolve({ status: 'authenticated', user: user as SubscriptionSessionUser });
					} else {
						resolve(
							(info as { name?: unknown } | undefined)?.name === 'TokenExpiredError'
								? { status: 'expired' }
								: { status: 'refused' }
						);
					}
				};

				try {
					// `next` is reached only when passport could not run the strategy at all — none is registered
					// under the name in this process.
					passport.authenticate(SUBSCRIPTION_AUTH_STRATEGY, { session: false }, answer)(req, {}, () =>
						resolve({ status: 'unavailable' })
					);
				} catch {
					resolve({ status: 'unavailable' });
				}
			})
	);
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
 * the guards authenticate it with the resolver they use for HTTP. The request is also what the
 * operation's request context is built from: `createSubscriptionServerOptions`'s `execute` and
 * `subscribe` open the store `RequestContext` reads around the operation (`RequestContextMiddleware`,
 * which opens it on HTTP, never runs for a socket), and the user the `AuthGuard` attaches to this
 * request is the one `TenantPermissionGuard` and every tenant-scoped read then see.
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
		const req = subscriptionRequest(headers);

		// The operation's streams are held to the connection's credential session (`subscribeInRequestContext`).
		attachSubscriptionSession(req, subscriptionSessionOfConnection(context));

		return { req, headers };
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
