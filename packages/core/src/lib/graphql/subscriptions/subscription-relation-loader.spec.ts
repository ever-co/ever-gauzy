import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { ExecutionArgs, ExecutionResult, GraphQLObjectType, buildSchema } from 'graphql';
import { GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from 'graphql-ws';
import { sign } from 'jsonwebtoken';
import { ClsService } from 'nestjs-cls';
import { RequestContext } from '../../core/context/request-context';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../../core/testing/mikro-orm-outside-request';
import { RelationLoaderRegistry } from '../batch/relation-loader.registry';
import { GraphqlRequestContext, createGraphqlRequestContext } from '../graphql-context';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { MikroOrmAwareApolloDriver } from './subscription-filter-context';
import { runInOperationRequestContext } from './subscription-request-context';
import { createSubscriptionServerOptions, graphqlContextArguments } from './subscription-transport';

/**
 * The relation loaders of a subscription stream, on the socket.
 *
 * `graphql-ws` builds one GraphQL context per operation, and a subscription is one operation that stays open for as
 * long as the client listens: graphql-js executes every event it delivers with that same context. The context's
 * `RelationLoaderRegistry` caches what its loaders load, as it must within one execution, so a relation an event
 * selected — an operation's `steps` — was answered for every later event of the stream from what the first one read,
 * whatever had changed since. These cases change the rows between two events and expect the second to read them.
 *
 * The operations run through `graphql-ws` itself with the options the transport produces, the context factory
 * `graphql-helper.ts` installs and the filter wrapper the platform's Apollo driver puts around a
 * `@Subscription({ filter })`. The relation is resolved as `OperationResolver.steps` resolves it, through
 * `context.loaders.for('operation_step:operationId', …)`; its batch function reads the rows as they are when it runs,
 * and, under DB_ORM=mikro-orm, writes through a real MikroORM instance that refuses its global EntityManager outside a
 * request context, as a repository would read.
 */
describe.each(['typeorm', 'mikro-orm'])('relation loaders on a subscription stream under DB_ORM=%s', (dbOrm) => {
	const TENANT = 'tenant-a';
	const TOKEN = `Bearer ${sign({ id: 'user-a' }, 'subscription-relation-loader-spec-secret')}`;
	const STEPS = 'operation_step:operationId';

	const originalOrm = process.env.DB_ORM;
	const originalClsService = RequestContext['clsService'];

	let mikroOrm: IMikroOrmOutsideRequest;
	let pubSub: GraphqlPubSub;
	/** The step rows, by operation: what the batch function reads when it runs. */
	let rows: Map<string, string[]>;
	/** The keys of every call of the batch function, in order. */
	let batches: string[][];
	/** The EntityManager each batch ran on (none under TypeORM). */
	let batchedOn: Array<EntityManager | undefined>;
	/** The registry each selection of `steps` was resolved with, in order. */
	let resolvedWith: RelationLoaderRegistry[];
	/** What the filter read for each candidate it was asked about. */
	let screened: string[][];
	/** How many streams the subscription resolvers opened: a publish after that reaches them. */
	let opened: number;

	/** The steps relation of one context, as `OperationResolver.steps` opens it. */
	const stepsOf = (context: GraphqlRequestContext) =>
		context.loaders.for<string, string[]>(STEPS, async (operationIds) => {
			batches.push([...operationIds]);
			batchedOn.push(dbOrm === 'mikro-orm' ? await mikroOrm.write() : MikroOrmRequestContext.getEntityManager());
			return operationIds.map((id) => [...(rows.get(id) ?? [])]);
		});

	const createSchema = () => {
		const schema = buildSchema(`
			type Query { operation(id: ID!): Operation }
			type Subscription { operationsChanged: [Operation!]!, operationScreened: [Operation!]! }
			type Operation { id: ID!, steps: [String!]! }
		`);

		const query = (schema.getQueryType() as GraphQLObjectType).getFields();
		query['operation'].resolve = (_root, args: { id: string }) => ({ id: args.id });

		const operation = (schema.getType('Operation') as GraphQLObjectType).getFields();
		operation['steps'].resolve = (parent: { id: string }, _args, context: GraphqlRequestContext) => {
			resolvedWith.push(context.loaders);
			return stepsOf(context).load(parent.id);
		};

		const subscription = (schema.getSubscriptionType() as GraphQLObjectType).getFields();
		// A stream with no filter: each pull is one event.
		subscription['operationsChanged'].subscribe = () => {
			opened += 1;
			return pubSub.asyncIterableIterator(pubSub.topicFor('operation.changed', TENANT));
		};
		subscription['operationsChanged'].resolve = (payload: { operations: unknown[] }) => payload.operations;

		// What `@Subscription('operationScreened', { filter })` becomes under the platform's Apollo driver, with a
		// filter that reads the relation of each candidate through the context's loaders. It rejects a candidate marked
		// `reject`, and the driver then awaits the next one inside the same pull.
		subscription['operationScreened'].subscribe = MikroOrmAwareApolloDriver.prototype.subscriptionWithFilter(
			undefined,
			async (
				payload: { operations: Array<{ id: string }>; reject?: boolean },
				_variables: unknown,
				context: GraphqlRequestContext
			) => {
				screened.push(await stepsOf(context).load(payload.operations[0].id));
				return !payload.reject;
			},
			() => () => {
				opened += 1;
				return pubSub.asyncIterableIterator(pubSub.topicFor('operation.screened', TENANT));
			}
		);
		subscription['operationScreened'].resolve = (payload: { operations: unknown[] }) => payload.operations;

		return schema;
	};

	/** Opens a connection on a `graphql-ws` server built from the transport's options, given the MikroORM instance. */
	const connect = () => {
		const sent: Array<{ id?: string; type: string; payload?: unknown }> = [];
		let receive: (data: string) => Promise<void> = async () => undefined;

		const server = makeServer({
			schema: createSchema(),
			context: (connection: unknown) => createGraphqlRequestContext(graphqlContextArguments(connection)),
			...createSubscriptionServerOptions({ orm: mikroOrm.orm })
		} as unknown as Parameters<typeof makeServer>[0]);
		const release = server.opened(
			{
				protocol: GRAPHQL_TRANSPORT_WS_PROTOCOL,
				send: async (data: string) => {
					sent.push(JSON.parse(data));
				},
				close: () => undefined,
				onMessage: (callback: (data: string) => Promise<void>) => {
					receive = callback;
				}
			},
			{ request: { headers: {} } }
		);

		const open: Array<{ id: string; delivering: Promise<void> }> = [];

		return {
			send: (message: unknown) => receive(JSON.stringify(message)),
			/** Opens a subscription, which stays in `graphql-ws`'s delivery loop until it completes: not awaited. */
			subscribe: (id: string, query: string) => {
				open.push({ id, delivering: receive(JSON.stringify({ id, type: 'subscribe', payload: { query } })) });
			},
			/** Completes every subscription opened, waits for their loops to end, and closes the socket. */
			end: async () => {
				for (const { id } of open) {
					await receive(JSON.stringify({ id, type: 'complete' }));
				}
				await Promise.all(open.map(({ delivering }) => delivering));
				await release(1000, 'done');
			},
			/** The payloads of the `next` messages of one operation. */
			results: (id: string) =>
				sent.filter((message) => message.id === id && message.type === 'next').map((m) => m.payload)
		};
	};

	/** Waits until a condition holds. */
	const until = async (condition: () => boolean, timeoutMs = 3000): Promise<void> => {
		const deadline = Date.now() + timeoutMs;

		while (!condition() && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		expect(condition()).toBe(true);
	};

	beforeAll(async () => {
		mikroOrm = await mikroOrmOutsideRequest();
	});

	afterAll(async () => {
		await mikroOrm.close();
	});

	beforeEach(() => {
		process.env.DB_ORM = dbOrm;
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		pubSub = new GraphqlPubSub();
		rows = new Map();
		batches = [];
		batchedOn = [];
		resolvedWith = [];
		screened = [];
		opened = 0;
	});

	afterEach(() => {
		pubSub.onModuleDestroy();
		RequestContext['clsService'] = originalClsService;
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
	});

	it('reads the relation of each event as it is when the event is delivered, batched within the event', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN } });
		socket.subscribe('1', 'subscription { operationsChanged { id steps again: steps } }');

		rows.set('op-1', ['created']);
		rows.set('op-2', ['created']);
		await until(() => opened === 1);
		await pubSub.publish('operation.changed', TENANT, { operations: [{ id: 'op-1' }, { id: 'op-2' }] });
		await until(() => socket.results('1').length === 1);

		// The steps change between the two events, as a worker advancing the operations would change them.
		rows.set('op-1', ['created', 'started']);
		rows.set('op-2', ['created', 'failed']);
		await pubSub.publish('operation.changed', TENANT, { operations: [{ id: 'op-1' }, { id: 'op-2' }] });
		await until(() => socket.results('1').length === 2);
		await socket.end();

		// Before, the second event was answered from what the first one loaded: `['created']` twice.
		expect(socket.results('1')).toEqual([
			{
				data: {
					operationsChanged: [
						{ id: 'op-1', steps: ['created'], again: ['created'] },
						{ id: 'op-2', steps: ['created'], again: ['created'] }
					]
				}
			},
			{
				data: {
					operationsChanged: [
						{ id: 'op-1', steps: ['created', 'started'], again: ['created', 'started'] },
						{ id: 'op-2', steps: ['created', 'failed'], again: ['created', 'failed'] }
					]
				}
			}
		]);

		// One batch per event, for both operations and both selections: batching within an event is kept, and the
		// second event asks the database again instead of the first event's cache.
		expect(batches).toEqual([
			['op-1', 'op-2'],
			['op-1', 'op-2']
		]);

		// Each event resolves its selections with one registry of its own.
		expect(resolvedWith).toHaveLength(8);
		const [first, second] = [new Set(resolvedWith.slice(0, 4)), new Set(resolvedWith.slice(4))];
		expect(first.size).toBe(1);
		expect(second.size).toBe(1);
		expect([...first][0]).not.toBe([...second][0]);

		// Under DB_ORM=mikro-orm each batch read on the fork of its own event; under TypeORM no context was looked for.
		if (dbOrm === 'mikro-orm') {
			expect(batchedOn).toHaveLength(2);
			for (const fork of batchedOn) {
				expect(fork).toBeDefined();
				expect(fork).not.toBe(mikroOrm.orm.em);
			}
			expect(batchedOn[0]).not.toBe(batchedOn[1]);
		} else {
			expect(batchedOn).toEqual([undefined, undefined]);
		}
	});

	it('decides each candidate a filter reads a relation for on the relation as it is then', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN } });
		socket.subscribe('1', 'subscription { operationScreened { id steps } }');

		rows.set('op-1', ['created']);
		await until(() => opened === 1);
		// The filter rejects the first candidate, and the driver awaits the next inside the same pull of the stream.
		await pubSub.publish('operation.screened', TENANT, { operations: [{ id: 'op-1' }], reject: true });
		await until(() => screened.length === 1);

		rows.set('op-1', ['created', 'started']);
		await pubSub.publish('operation.screened', TENANT, { operations: [{ id: 'op-1' }] });
		await until(() => socket.results('1').length === 1);
		await socket.end();

		// Before, the second candidate was decided, and delivered, on what the rejected one had loaded.
		expect(screened).toEqual([['created'], ['created', 'started']]);
		expect(socket.results('1')).toEqual([
			{ data: { operationScreened: [{ id: 'op-1', steps: ['created', 'started'] }] } }
		]);
		// The accepted candidate's own filter and its selection share one batch, as one event's resolution does.
		expect(batches).toEqual([['op-1'], ['op-1']]);
	});

	it('keeps one registry for a whole query on the socket, as an HTTP request does', async () => {
		const socket = connect();

		rows.set('op-1', ['created']);
		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN } });
		await socket.send({
			id: '1',
			type: 'subscribe',
			payload: { query: '{ a: operation(id: "op-1") { steps } b: operation(id: "op-1") { steps } }' }
		});
		await socket.end();

		expect(socket.results('1')).toEqual([{ data: { a: { steps: ['created'] }, b: { steps: ['created'] } } }]);
		// Both selections from one load: one registry, one batch, the second answered from the first one's cache.
		expect(new Set(resolvedWith).size).toBe(1);
		expect(batches).toEqual([['op-1']]);
		expect(resolvedWith[0].stats.cacheHits).toBe(1);
	});

	it('gives each pull of a stream opened without a request loaders of its own too', async () => {
		const context = createGraphqlRequestContext();
		const atSubscribe = context.loaders;
		const pulled: RelationLoaderRegistry[] = [];

		// A stream whose every pull resolves its event with the context's loaders, as graphql-js executes each event.
		const stream: AsyncIterable<ExecutionResult> = {
			[Symbol.asyncIterator]: () => ({
				next: async () => {
					pulled.push(context.loaders);
					return { value: { data: {} }, done: false };
				}
			})
		};

		const result = await runInOperationRequestContext(
			{ contextValue: context } as ExecutionArgs,
			async () => stream,
			mikroOrm.orm
		);
		const iterator = (result as AsyncIterable<ExecutionResult>)[Symbol.asyncIterator]();
		await iterator.next();
		await iterator.next();

		expect(pulled).toHaveLength(2);
		for (const registry of pulled) {
			expect(registry).toBeInstanceOf(RelationLoaderRegistry);
			expect(registry).not.toBe(atSubscribe);
		}
		expect(pulled[0]).not.toBe(pulled[1]);
	});
});
