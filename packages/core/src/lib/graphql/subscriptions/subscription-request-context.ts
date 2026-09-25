import { AsyncResource } from 'async_hooks';
import { ExecutionArgs, ExecutionResult, execute, subscribe } from 'graphql';
import type { Request } from 'express';
import { RequestContext } from '../../core/context/request-context';

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
 */

/**
 * What `graphql-ws` accepts back from `execute` and `subscribe`.
 */
type OperationResult = ExecutionResult | AsyncIterable<ExecutionResult>;

/**
 * Runs a query or a mutation from the socket inside the operation's request context.
 *
 * @param args The execution arguments `graphql-ws` built for the operation.
 * @returns The operation's result.
 */
export function executeInRequestContext(args: ExecutionArgs): Promise<OperationResult> {
	return runInOperationRequestContext(args, () => execute(args));
}

/**
 * Opens a subscription from the socket inside the operation's request context.
 *
 * @param args The execution arguments `graphql-ws` built for the operation.
 * @returns The event stream, bound to the operation's context — or the errors that refused it.
 */
export function subscribeInRequestContext(args: ExecutionArgs): Promise<OperationResult> {
	return runInOperationRequestContext(args, () => subscribe(args));
}

/**
 * Runs one operation inside a request context built from its request.
 *
 * An operation whose context carries no request runs as it did before, with no context: building one
 * around nothing would give every accessor an object to read a user from that no guard can ever
 * authenticate, and the guards already refuse an operation they cannot authenticate.
 *
 * @param args The execution arguments.
 * @param operation The operation.
 * @returns The operation's result, with a stream bound to the context it was opened in.
 */
export async function runInOperationRequestContext(
	args: ExecutionArgs,
	operation: () => OperationResult | Promise<OperationResult>
): Promise<OperationResult> {
	const req = operationRequest(args);

	if (!req) {
		return operation();
	}

	return RequestContext.runWithRequest(req, async () => {
		const result = await operation();

		// Bound here, inside the store, because a binding captures the context it was made in.
		return isAsyncIterable(result) ? bindToCurrentContext(result) : result;
	});
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
