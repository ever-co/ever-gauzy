import { AsyncResource } from 'async_hooks';
import type { MikroORM } from '@mikro-orm/core';
import { ExecutionArgs, ExecutionResult, execute, subscribe } from 'graphql';
import type { Request } from 'express';
import { runInMikroOrmContext } from '../../core/context/mikro-orm-context';
import { RequestContext } from '../../core/context/request-context';
import { getORMType, MultiORMEnum } from '../../core/utils';
import { SubscriptionSessionUser, subscriptionSessionOf } from './subscription-session';

/**
 * The request context of an operation on the subscription socket.
 *
 * On HTTP, `RequestContextMiddleware` opens a CLS store for every request, and everything that asks
 * `RequestContext` who the caller is — the guards, the services that scope a read by tenant, the
 * filter a subscription screens its events with — reads it from that store. The middleware is Express
 * middleware, so an operation that arrives in a WebSocket message never passes through it, and until
 * this file existed it ran with no store at all: `TenantPermissionGuard` found no tenant and refused
 * every subscription, and a subscription's filter compared every event's tenant with null.
 *
 * `graphql-ws` calls one function to run a query or a mutation and another to open a subscription.
 * Both are replaced here by the same functions from `graphql`, run inside a store of their own that
 * holds a context built from the operation's request — the request the context factory built from the
 * connection's credential (`graphqlContextArguments`). That request is the object the guards
 * authenticate and attach the user to, so the credential reaches `RequestContext` the way it does on
 * HTTP, and tenant and organization scoping read the same answers.
 *
 * **One store per operation.** The context factory runs per operation and builds a new request each
 * time, and a new store is opened for each call. Two operations on one socket share nothing, and two
 * sockets share nothing; a user attached while one operation was authenticated is never visible to
 * another.
 *
 * **A subscription keeps its store for its whole life.** A subscription does its work long after the
 * call that opened it has returned: every event is pulled from the stream by `graphql-ws`'s own loop,
 * and the filter a resolver declares runs inside that pull. The loop runs in the socket's context, not
 * in the operation's, so the stream handed back is bound to the operation's store — each `next`,
 * `return` and `throw` runs inside it, and the filter sees the subscriber that opened the stream.
 *
 * **…and is held to its connection's credential for as long.** The user in that store is the one the guards
 * authenticated when the subscription opened, and nothing re-reads it while events flow. The connection's
 * `SubscriptionSession` judges the credential again before an event is delivered (at most once per interval),
 * and closes the socket when the token expired, the account no longer authenticates, or the role, permissions
 * or scope it resolves to are no longer the ones the stream was authorized with — so neither the filters nor
 * a scope captured when the stream opened can outlive the authorization they were read under.
 *
 * 🛑 **Under DB_ORM=mikro-orm an operation on the socket had no MikroORM context either.** On HTTP the bootstrap opens
 * a fork of MikroORM's EntityManager for every request on the GraphQL endpoint, as `@mikro-orm/nestjs` does for every
 * REST route; that is Express middleware too, and MikroORM refuses its global EntityManager outside a context ("Using
 * global EntityManager instance methods for context specific actions is disallowed"). So the JWT strategy's user
 * lookup failed and every socket operation was answered as unauthenticated, and a stream that got past that read
 * nothing through a repository. Each operation now gets a fork of its own, as an HTTP request does
 * ({@link runInOperationRequestContext}), and each pull of a stream — one event's filter, its `resolve` and the
 * fields selected under it — a fresh fork of that one, so a stream that stays open for hours does not answer every
 * event from one identity map filled by the events before it. Under TypeORM no context is opened and nothing changes.
 */

/**
 * What `graphql-ws` accepts back from `execute` and `subscribe`.
 */
type OperationResult = ExecutionResult | AsyncIterable<ExecutionResult>;

/**
 * Runs a query or a mutation from the socket inside the operation's request context.
 *
 * @param args The execution arguments `graphql-ws` built for the operation.
 * @param orm The MikroORM instance of this process, when it has one: under DB_ORM=mikro-orm the operation runs on a
 * fork of its own.
 * @returns The operation's result.
 */
export function executeInRequestContext(args: ExecutionArgs, orm?: MikroORM | null): Promise<OperationResult> {
	return runInOperationRequestContext(args, () => execute(args), orm);
}

/**
 * Opens a subscription from the socket inside the operation's request context.
 *
 * @param args The execution arguments `graphql-ws` built for the operation.
 * @param orm The MikroORM instance of this process, when it has one: under DB_ORM=mikro-orm the subscription opens on
 * a fork of its own, and each pull of its stream runs on a fresh fork of that one.
 * @returns The event stream, bound to the operation's context — or the errors that refused it.
 */
export function subscribeInRequestContext(args: ExecutionArgs, orm?: MikroORM | null): Promise<OperationResult> {
	return runInOperationRequestContext(args, () => subscribe(args), orm);
}

/**
 * Runs one operation inside a request context built from its request.
 *
 * An operation whose context carries no request runs as it did before, with no request context: building one
 * around nothing would give every accessor an object to read a user from that no guard can ever
 * authenticate, and the guards already refuse an operation they cannot authenticate.
 *
 * Under DB_ORM=mikro-orm, with the instance at hand, the operation also runs in a MikroORM context of its own — the
 * fork the bootstrap opens for an HTTP request on the same endpoint — whether it carries a request or not, and each
 * pull of the stream it opens runs on a fresh fork of that one ({@link forkMikroOrmContextPerPull}).
 *
 * @param args The execution arguments.
 * @param operation The operation.
 * @param orm The MikroORM instance of this process, when it has one.
 * @returns The operation's result, with a stream bound to the context it was opened in.
 */
export async function runInOperationRequestContext(
	args: ExecutionArgs,
	operation: () => OperationResult | Promise<OperationResult>,
	orm?: MikroORM | null
): Promise<OperationResult> {
	const req = operationRequest(args);

	if (!req) {
		return runInMikroOrmContext(orm, async () => {
			const result = await operation();

			if (!isAsyncIterable<ExecutionResult>(result)) {
				return result;
			}

			// Bound to the operation's fork under DB_ORM=mikro-orm, as a stream with a request is, so each pull forks
			// that one — with whatever filter parameters or schema it was given — rather than the global EntityManager.
			// Under TypeORM the stream is handed back as it is, unbound, as it was.
			const forked = forkMikroOrmContextPerPull(result, orm);

			return forked === result ? result : bindToCurrentContext(forked);
		});
	}

	return RequestContext.runWithRequest(req, () =>
		runInMikroOrmContext(orm, () => openInRequestContext(req, operation, orm))
	);
}

/**
 * Runs one operation inside the contexts already opened for it, and holds the stream it opens to the connection's
 * credential and to those contexts.
 *
 * @param req The operation's request.
 * @param operation The operation.
 * @param orm The MikroORM instance of this process, when it has one.
 * @returns The operation's result, with a stream bound to the context it was opened in.
 */
async function openInRequestContext(
	req: Request,
	operation: () => OperationResult | Promise<OperationResult>,
	orm?: MikroORM | null
): Promise<OperationResult> {
	const result = await operation();

	if (!isAsyncIterable(result)) {
		return result;
	}

	// A stream the guards authorized is held to the connection's credential for as long as it runs: the
	// session judges the credential again before an event is delivered and closes the socket when it no
	// longer holds (see `subscription-session.ts`). The guards have just judged it, so that judgement is
	// the session's starting point.
	const session = subscriptionSessionOf(req);
	const user = authenticatedUserOf(req);
	let stream: AsyncIterable<ExecutionResult> = result;

	if (session && user) {
		session.confirm(user);
		stream = session.guard(result, () => authenticatedUserOf(req));
	}

	// Bound here, inside the store, because a binding captures the context it was made in. The fresh MikroORM
	// fork of each pull is opened inside the binding: a binding restores every store it captured — this
	// operation's fork among them — so a fork opened around it would be replaced by the operation's own.
	return bindToCurrentContext(forkMikroOrmContextPerPull(stream, orm));
}

/**
 * Runs each pull of a stream in a MikroORM context of its own, on a fresh fork, under DB_ORM=mikro-orm with the instance
 * at hand.
 *
 * Everything an event costs runs inside one pull: the `filter` of a `@Subscription` (the Apollo driver applies it as
 * the stream is read), graphql-js's execution of the event — the field's `resolve` and every field selected under it,
 * relations included — and the session's judgement of the credential. Inside the operation's binding the context in
 * force is the operation's own fork, which lives as long as the stream; each pull runs on a fresh fork of it (MikroORM
 * forks the context in force), so one event never reads an entity an earlier one left in that fork's identity map, and
 * the map does not grow for as long as the stream is open. `return` and `throw` only end the stream and read nothing,
 * so they are passed on as they are.
 *
 * Two things the fork does not cover. The GraphQL context's relation loaders (`RelationLoaderRegistry`) are built once
 * per stream and cache what they load, so a relation an earlier event loaded can be answered from that cache: the
 * fork resets the identity map, not those loaders. And Apollo may evaluate the `filter` of several candidate events
 * within one pull, which then share that pull's fork; that is safe while no `@Subscription` filter reads through the
 * ORM, and none does (each compares the payload with the request context).
 *
 * Under TypeORM, or without the instance, the stream is handed back as it is.
 *
 * @param stream The stream.
 * @param orm The MikroORM instance of this process, when it has one.
 * @returns The stream, each pull on a fork of its own.
 */
export function forkMikroOrmContextPerPull<T>(stream: AsyncIterable<T>, orm?: MikroORM | null): AsyncIterable<T> {
	if (!orm || getORMType() !== MultiORMEnum.MikroORM) {
		return stream;
	}

	const iterator = stream[Symbol.asyncIterator]();

	const forked: AsyncIterableIterator<T> = {
		next: (...args: [] | [unknown]) => runInMikroOrmContext(orm, () => iterator.next(...args)),
		return: (value?: unknown): Promise<IteratorResult<T>> =>
			typeof iterator.return === 'function'
				? iterator.return(value)
				: Promise.resolve({ value: undefined, done: true } as IteratorResult<T>),
		throw: (error?: unknown): Promise<IteratorResult<T>> =>
			typeof iterator.throw === 'function' ? iterator.throw(error) : Promise.reject(error),
		[Symbol.asyncIterator]() {
			return forked;
		}
	};

	return forked;
}

/**
 * The user the guards authenticated an operation's request as: the one `JwtStrategy` attached, which always
 * carries an id. A key pair's tenant-only stand-in is not one.
 *
 * @param req The operation's request.
 * @returns The user, or undefined.
 */
function authenticatedUserOf(req: Request): SubscriptionSessionUser | undefined {
	const user = (req as { user?: SubscriptionSessionUser }).user;

	return user && typeof user === 'object' && user.id ? user : undefined;
}

/**
 * Binds a stream to the context it is bound in, so every pull runs there whoever makes it.
 *
 * `graphql-ws` pulls from the stream with `for await` and ends it with `return()`, both from the
 * socket's message handler. The wrapper keeps the stream's shape — `graphql-ws` treats a value with
 * `return` as a generator it must close when the client completes the operation or the socket goes
 * away — and forwards each call, inside the bound context, to the stream it wraps.
 *
 * @param stream The stream.
 * @returns The bound stream.
 */
export function bindToCurrentContext<T>(stream: AsyncIterable<T>): AsyncIterableIterator<T> {
	const iterator = stream[Symbol.asyncIterator]();

	const next = AsyncResource.bind((...args: [] | [unknown]) => iterator.next(...args));
	const finish = AsyncResource.bind(
		(value?: unknown): Promise<IteratorResult<T>> =>
			typeof iterator.return === 'function'
				? iterator.return(value)
				: Promise.resolve({ value: undefined, done: true } as IteratorResult<T>)
	);
	const fail = AsyncResource.bind(
		(error?: unknown): Promise<IteratorResult<T>> =>
			typeof iterator.throw === 'function' ? iterator.throw(error) : Promise.reject(error)
	);

	const bound: AsyncIterableIterator<T> = {
		next,
		return: finish,
		throw: fail,
		[Symbol.asyncIterator]() {
			return bound;
		}
	};

	return bound;
}

/**
 * Whether an event's organization lets it reach the subscriber a `@Subscription` filter runs for.
 *
 * The filter runs inside the stream bound to the subscriber's operation, so the organization read here
 * is the subscriber's (`RequestContext.currentOrganizationId()`, the validated organization of the
 * credential, never an argument). An event that belongs to an organization reaches only a subscriber
 * acting in that organization. A subscriber with no organization is not sent it either: the reads
 * these streams mirror (`webhookDeliveries`, `webhookSubscriptions`, `eventDeliveries`) scope a caller
 * with no organization to the rows stored without one, so a missing organization is not a tenant-wide
 * wildcard, which is also the rule the `Subscription.events` field applies. An event with no
 * organization is tenant-wide and reaches every subscriber of its tenant.
 *
 * @param organizationId The organization the event belongs to.
 * @returns False when the event belongs to another organization than the subscriber's.
 */
export function matchesSubscriberOrganization(organizationId: unknown): boolean {
	const subscriberOrganizationId = RequestContext.currentOrganizationId();

	return !organizationId || String(organizationId) === String(subscriberOrganizationId ?? '');
}

/**
 * The request an operation was given by the context factory.
 *
 * @param args The execution arguments.
 * @returns The request, when the context carries one.
 */
function operationRequest(args: ExecutionArgs): Request | undefined {
	const req = (args?.contextValue as { req?: unknown } | undefined)?.req;

	return req && typeof req === 'object' ? (req as Request) : undefined;
}

/**
 * Whether a result is a stream rather than a single result.
 *
 * @param value The result.
 * @returns True for a stream.
 */
function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
	);
}
