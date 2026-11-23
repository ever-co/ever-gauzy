import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { UnauthorizedException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { ExecutionArgs, ExecutionResult, GraphQLObjectType, buildSchema } from 'graphql';
import { GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from 'graphql-ws';
import { sign } from 'jsonwebtoken';
import { ClsService } from 'nestjs-cls';
import * as passport from 'passport';
import { ExtractJwt, Strategy as PassportJwtStrategy } from 'passport-jwt';
import { RequestContext } from '../../core/context/request-context';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../../core/testing/mikro-orm-outside-request';
import { createGraphqlRequestContext } from '../graphql-context';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { openPlatformEventStream } from './platform-events.resolver';
import { deliverPayloadAsIs, tenantScopedTopicStream } from './plugin-subscription';
import { SubscriptionCatalogue } from './subscription-catalogue';
import type { SubscriptionClock } from './subscription-delivery';
import { GraphqlSubscriptionHub } from './subscription-hub.service';
import { runInOperationRequestContext } from './subscription-request-context';
import { MikroOrmAwareApolloDriver } from './subscription-filter-context';
import { SubscriptionAuthorizer } from './subscription-scope';
import { createSubscriptionServerOptions, graphqlContextArguments } from './subscription-transport';

/**
 * The subscription socket under DB_ORM=mikro-orm.
 *
 * MikroORM refuses its global EntityManager outside a request context, and the fork the bootstrap opens for the GraphQL
 * endpoint is Express middleware, which a WebSocket message never passes through. So on the socket the JWT strategy's
 * user lookup failed — every operation was answered as unauthenticated — and so did every read a stream made while it
 * delivered: a `@Subscription`'s filter and `resolve`, the fields selected under it, a plugin stream's scoped re-read,
 * the hub's live permission check and the session's judgement of the credential.
 *
 * The MikroORM instance is a real one, over SQLite, that refuses as the API's does
 * (`mikro-orm-outside-request.ts`); every step below writes through it as a repository would, and records the fork it
 * ran on. The operations run through `graphql-ws` itself with the options the transport produces, the context factory
 * `graphql-helper.ts` installs, the filter wrapper the Apollo driver puts around a `@Subscription({ filter })`, and a
 * passport `jwt` strategy — the one the global `AuthGuard` and the session's judgement both run — whose user lookup
 * reads through MikroORM, as `JwtStrategy`'s does.
 */
describe('the subscription socket under DB_ORM=mikro-orm', () => {
	const SECRET = 'subscription-mikro-orm-context-spec-secret';
	const TENANT_A = 'tenant-a';
	const ORG_A = 'organization-a';
	/** The user the token names, as the strategy attaches it after reading the database. */
	const USER_A = { id: 'user-a', tenantId: TENANT_A, lastOrganizationId: ORG_A };
	const TOKEN_A = `Bearer ${sign({ id: USER_A.id }, SECRET)}`;
	const REAUTH_INTERVAL_MS = 60_000;

	const originalOrm = process.env.DB_ORM;
	const originalClsService = RequestContext['clsService'];

	let mikroOrm: IMikroOrmOutsideRequest;
	let pubSub: GraphqlPubSub;
	let catalogue: SubscriptionCatalogue;
	let hub: GraphqlSubscriptionHub;
	/** The session clock, moved by hand to make a judgement of the credential due. */
	let now: number;
	/** Every step that read through MikroORM, and the EntityManager it ran on (none under TypeORM). */
	let seen: Array<{ step: string; em: EntityManager | undefined }>;

	/**
	 * What a repository call does at each step: under DB_ORM=mikro-orm a write through MikroORM, refused outside a
	 * context; under TypeORM MikroORM is never asked, so only the context in force (none) is recorded.
	 */
	const touch = async (step: string): Promise<void> => {
		if (process.env.DB_ORM === 'mikro-orm') {
			seen.push({ step, em: await mikroOrm.write() });
		} else {
			seen.push({ step, em: MikroOrmRequestContext.getEntityManager() });
		}
	};

	/** The forks a step ran on, in order. */
	const forksOf = (step: string) => seen.filter((entry) => entry.step === step).map((entry) => entry.em);

	/** What the global `AuthGuard` does: run the `jwt` strategy on the operation's request and attach its user. */
	const authenticate = (req: { headers?: Record<string, string>; user?: unknown }): Promise<void> =>
		new Promise((resolve, reject) =>
			passport.authenticate('jwt', { session: false }, (error: unknown, user: unknown) => {
				if (error) return reject(error);
				if (!user) return reject(new UnauthorizedException());
				req.user = user;
				resolve();
			})(req, {}, () => reject(new Error('no jwt strategy')))
		);

	/** A field guarded as the platform guards one: authenticated first, then resolved. */
	const guarded =
		<T>(resolver: () => T | Promise<T>) =>
		async (_root: unknown, _args: unknown, context: { req: Parameters<typeof authenticate>[0] }): Promise<T> => {
			await authenticate(context.req);
			return resolver();
		};

	const createSchema = () => {
		const schema = buildSchema(`
			type Query { whoami: Caller }
			type Caller { id: ID, tenantId: ID }
			type Subscription { widgetChanged: Widget, widgetStreamed: Widget, events(names: [String!]!): EventEnvelope }
			type Widget { id: ID!, tenantId: ID!, label: String }
			type EventEnvelope { eventId: ID!, eventName: String! }
		`);

		const query = (schema.getQueryType() as GraphQLObjectType).getFields();
		query['whoami'].resolve = (root, args, context) =>
			guarded(async () => {
				await touch('query');
				return { id: RequestContext.currentUserId(), tenantId: RequestContext.currentTenantId() };
			})(root, args, context);

		const widget = (schema.getType('Widget') as GraphQLObjectType).getFields();
		// A field selected under the event, as a relation resolved through a repository is.
		widget['label'].resolve = async (payload: { id: string }) => {
			await touch('field');
			return `widget ${payload.id}`;
		};

		const subscription = (schema.getSubscriptionType() as GraphQLObjectType).getFields();
		// What `@Subscription('widgetChanged', { filter, resolve })` becomes under the platform's Apollo driver, with a
		// filter and a `resolve` that read through MikroORM. The filter rejects an event marked `reject`.
		subscription['widgetChanged'].subscribe = MikroOrmAwareApolloDriver.prototype.subscriptionWithFilter(
			undefined,
			async (payload: { tenantId?: string; reject?: boolean }) => {
				await touch('filter');
				return payload?.tenantId === RequestContext.currentTenantId() && !payload.reject;
			},
			() =>
				guarded(async () => {
					await touch('subscribe');
					return pubSub.asyncIterableIterator(pubSub.topicFor('widget.changed', TENANT_A));
				})
		);
		subscription['widgetChanged'].resolve = async (payload: unknown) => {
			await touch('resolve');
			return payload;
		};

		// A plugin's stream, over the kernel's adapter, with the scoped re-read every plugin stream makes.
		subscription['widgetStreamed'].subscribe = guarded(async () => {
			await touch('subscribe');
			return tenantScopedTopicStream<{ aggregate?: { id: string } }, { id: string; tenantId: string }>(
				pubSub,
				'widget.streamed',
				{
					read: async (envelope, scope) => {
						await touch('read');
						return { id: String(envelope.aggregate?.id), tenantId: scope.tenantId };
					}
				}
			);
		});
		subscription['widgetStreamed'].resolve = deliverPayloadAsIs;

		// `Subscription.events`, over the hub, with the live permission check `rolePermissionEvaluator` makes.
		subscription['events'].subscribe = guarded(async () => {
			await touch('subscribe');
			return openPlatformEventStream(hub, {
				subscriberId: `user-a#${Math.random()}`,
				tenantId: TENANT_A,
				organizationId: ORG_A,
				credentialKind: 'jwt',
				credentialId: USER_A.id,
				requiredPermission: PermissionsEnum.EVENT_OUTBOX_VIEW,
				permissionEvaluator: async () => {
					await touch('permission');
					return true;
				},
				eventNames: ['gadget.changed']
			});
		});
		subscription['events'].resolve = deliverPayloadAsIs;

		return schema;
	};

	/** Opens one connection on a `graphql-ws` server built from the transport's options, handed the MikroORM instance. */
	const connect = () => {
		const sent: Array<{ id?: string; type: string; payload?: unknown }> = [];
		const closes: Array<number | undefined> = [];
		let receive: (data: string) => Promise<void> = async () => undefined;
		const clock: SubscriptionClock = { now: () => now, schedule: () => () => undefined };

		const server = makeServer({
			schema: createSchema(),
			context: (connection: unknown) => createGraphqlRequestContext(graphqlContextArguments(connection)),
			...createSubscriptionServerOptions({
				orm: mikroOrm.orm,
				reauthenticationIntervalMs: REAUTH_INTERVAL_MS,
				clock
			})
		} as unknown as Parameters<typeof makeServer>[0]);
		const release = server.opened(
			{
				protocol: GRAPHQL_TRANSPORT_WS_PROTOCOL,
				send: async (data: string) => {
					sent.push(JSON.parse(data));
				},
				close: (code?: number) => {
					closes.push(code);
				},
				onMessage: (callback: (data: string) => Promise<void>) => {
					receive = callback;
				}
			},
			{ request: { headers: {} } }
		);

		const open: Array<{ id: string; delivering: Promise<void> }> = [];

		return {
			closes,
			send: (message: unknown) => receive(JSON.stringify(message)),
			/**
			 * Opens a subscription. It stays inside `graphql-ws`'s delivery loop until it completes, so the message is
			 * sent and not awaited.
			 */
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

	/** Waits, on the real clock (the hub's coalescing window runs on it), until a condition holds. */
	const until = async (condition: () => boolean, timeoutMs = 3000): Promise<void> => {
		const deadline = Date.now() + timeoutMs;

		while (!condition() && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		expect(condition()).toBe(true);
	};

	/** Asserts that a list of forks are all real, all distinct, and none of them the global EntityManager. */
	const expectDistinctForks = (forks: Array<EntityManager | undefined>) => {
		for (const fork of forks) {
			expect(fork).toBeDefined();
			expect(fork).not.toBe(mikroOrm.orm.em);
		}
		expect(new Set(forks).size).toBe(forks.length);
	};

	beforeAll(async () => {
		mikroOrm = await mikroOrmOutsideRequest();
		// The platform's `JwtStrategy`, as far as these cases need it: the token is verified, then the user is looked up
		// through MikroORM. A lookup that fails is answered as a refusal (`401`), as `JwtStrategy.validate` answers it.
		passport.use(
			'jwt',
			new PassportJwtStrategy(
				{ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET },
				(payload: { id: string }, done: (error: unknown, user?: unknown) => void) => {
					touch('authenticate').then(
						() => done(null, payload.id === USER_A.id ? { ...USER_A } : false),
						(error) => done(new UnauthorizedException('unauthorized', { cause: error }))
					);
				}
			)
		);
	});

	afterAll(async () => {
		passport.unuse('jwt');
		await mikroOrm.close();
	});

	beforeEach(() => {
		process.env.DB_ORM = 'mikro-orm';
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		pubSub = new GraphqlPubSub();
		catalogue = new SubscriptionCatalogue();
		catalogue.declare('gadget.changed');
		hub = new GraphqlSubscriptionHub(pubSub, new SubscriptionAuthorizer(), catalogue);
		now = Date.parse('2026-11-23T10:00:00.000Z');
		seen = [];
	});

	afterEach(() => {
		hub.onModuleDestroy();
		pubSub.onModuleDestroy();
		RequestContext['clsService'] = originalClsService;
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

	it('authenticates a query and resolves it on a MikroORM fork of its own, as an HTTP request is', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { id tenantId } }' } });
		await socket.send({ id: '2', type: 'subscribe', payload: { query: '{ whoami { id } }' } });
		await socket.end();

		// Without a context the strategy's lookup was refused, and so was the operation: `unauthorized`.
		expect(socket.results('1')).toEqual([{ data: { whoami: { id: USER_A.id, tenantId: TENANT_A } } }]);
		expect(socket.results('2')).toEqual([{ data: { whoami: { id: USER_A.id } } }]);

		// One fork per operation, shared by its guard and its resolver, and not by the next operation.
		const [firstLookup, secondLookup] = forksOf('authenticate');
		const [firstQuery, secondQuery] = forksOf('query');
		expectDistinctForks([firstLookup, secondLookup]);
		expect(firstQuery).toBe(firstLookup);
		expect(secondQuery).toBe(secondLookup);
		// Nothing of a context outlives the operation.
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('opens a subscription on a fork of its own, and delivers each event on a fresh one', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		socket.subscribe('1', 'subscription { widgetChanged { id label } }');
		await until(() => forksOf('subscribe').length === 1);

		for (const id of ['w1', 'w2', 'w3']) {
			await pubSub.publish('widget.changed', TENANT_A, { id, tenantId: TENANT_A });
			await until(() => socket.results('1').length === ['w1', 'w2', 'w3'].indexOf(id) + 1);
		}
		await socket.end();

		expect(socket.results('1')).toEqual([
			{ data: { widgetChanged: { id: 'w1', label: 'widget w1' } } },
			{ data: { widgetChanged: { id: 'w2', label: 'widget w2' } } },
			{ data: { widgetChanged: { id: 'w3', label: 'widget w3' } } }
		]);

		// The guards and the resolver's body ran on the operation's fork.
		const [opened] = forksOf('subscribe');
		expect(forksOf('authenticate')).toEqual([opened]);

		// Each event — its `resolve` and the fields selected under it — on one fresh fork of its own, and its filter on a
		// fresh one again; never the fork the subscription opened on, which lives as long as the stream.
		const pulls = forksOf('resolve');
		const filters = forksOf('filter');
		expect(pulls).toHaveLength(3);
		expect(forksOf('field')).toEqual(pulls);
		expectDistinctForks([opened, ...pulls, ...filters]);
		// So no event reads what an earlier one left in an identity map: each fork holds that event's rows alone.
		for (const fork of pulls) {
			expect(fork?.getUnitOfWork().getIdentityMap().keys()).toHaveLength(2);
		}
		for (const fork of filters) {
			expect(fork?.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
		}
	});

	it('evaluates the filter on a fresh fork for each event, including those it rejects within one read', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		socket.subscribe('1', 'subscription { widgetChanged { id } }');
		await until(() => forksOf('subscribe').length === 1);

		// The driver drops a rejected event and awaits the next inside the same read of the stream, on the same pull.
		await pubSub.publish('widget.changed', TENANT_A, { id: 'w1', tenantId: TENANT_A, reject: true });
		await until(() => forksOf('filter').length === 1);
		await pubSub.publish('widget.changed', TENANT_A, { id: 'w2', tenantId: TENANT_A });
		await until(() => socket.results('1').length === 1);
		await socket.end();

		expect(socket.results('1')).toEqual([{ data: { widgetChanged: { id: 'w2' } } }]);

		// Both evaluations ran within one pull, whose fork executed the accepted event; each on a fork of its own, so the
		// second is not decided on what the first loaded.
		const [opened] = forksOf('subscribe');
		const [rejected, accepted] = forksOf('filter');
		const [pull] = forksOf('resolve');
		expectDistinctForks([opened, pull, rejected, accepted]);
		expect(accepted?.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
	});

	it('re-reads each event of a plugin stream on a fresh fork, not on the one the stream was opened in', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		socket.subscribe('1', 'subscription { widgetStreamed { id tenantId } }');
		await until(() => forksOf('subscribe').length === 1);

		for (const id of ['w1', 'w2']) {
			await pubSub.publish('widget.streamed', TENANT_A, {
				eventId: `event-${id}`,
				name: 'widget.streamed',
				tenantId: TENANT_A,
				occurredAt: '2026-11-23T10:00:00.000Z',
				aggregate: { type: 'Widget', id },
				data: {}
			});
			await until(() => socket.results('1').length === ['w1', 'w2'].indexOf(id) + 1);
		}
		await socket.end();

		expect(socket.results('1')).toEqual([
			{ data: { widgetStreamed: { id: 'w1', tenantId: TENANT_A } } },
			{ data: { widgetStreamed: { id: 'w2', tenantId: TENANT_A } } }
		]);

		// The re-read runs in the subscriber's context, restored when the stream was built — which holds the fork the
		// operation opened on. Each now runs on a fresh fork of that one.
		const [opened] = forksOf('subscribe');
		const reads = forksOf('read');
		expect(reads).toHaveLength(2);
		expectDistinctForks([opened, ...reads]);
		for (const fork of reads) {
			expect(fork?.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
		}
	});

	it('asks the hub’s live permission check of each event on a fresh fork', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		socket.subscribe('1', 'subscription { events(names: ["gadget.changed"]) { eventId eventName } }');
		await until(() => forksOf('subscribe').length === 1);

		for (const eventId of ['e1', 'e2']) {
			await hub.publish({
				eventId,
				name: 'gadget.changed',
				tenantId: TENANT_A,
				occurredAt: '2026-11-23T10:00:00.000Z',
				aggregate: { type: 'Gadget', id: 'g1' },
				data: {}
			});
			await until(() => socket.results('1').length === ['e1', 'e2'].indexOf(eventId) + 1);
		}
		await socket.end();

		expect(socket.results('1')).toEqual([
			{ data: { events: { eventId: 'e1', eventName: 'gadget.changed' } } },
			{ data: { events: { eventId: 'e2', eventName: 'gadget.changed' } } }
		]);

		// The first check is the hub's at subscribe, on the operation's fork; the hub then asks again of every event, in
		// the loop it started there — on a fresh fork each time, rather than on the operation's for as long as it runs.
		const [opened] = forksOf('subscribe');
		const [atSubscribe, ...perEvent] = forksOf('permission');
		expect(atSubscribe).toBe(opened);
		expect(perEvent).toHaveLength(2);
		expectDistinctForks([opened, ...perEvent]);
	});

	it('judges the credential again on a fork of its own, and keeps the socket open', async () => {
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		socket.subscribe('1', 'subscription { widgetChanged { id } }');
		await until(() => forksOf('subscribe').length === 1);

		// The judgement made when the stream opened is now stale: the next event is delivered only after another.
		now += REAUTH_INTERVAL_MS;
		await pubSub.publish('widget.changed', TENANT_A, { id: 'w1', tenantId: TENANT_A });
		await until(() => socket.results('1').length === 1);
		await socket.end();

		// Without a context the lookup was refused, the judgement answered `refused`, and the socket was closed with
		// `4401` instead of the event being delivered.
		expect(socket.results('1')).toEqual([{ data: { widgetChanged: { id: 'w1' } } }]);
		expect(socket.closes).toEqual([]);

		const [opened] = forksOf('subscribe');
		const [atSubscribe, judgement] = forksOf('authenticate');
		const [delivery] = forksOf('resolve');
		expect(atSubscribe).toBe(opened);
		expectDistinctForks([opened, delivery, judgement]);
	});

	it('gives an operation that carries no request a fork of its own too, and each pull of its stream a fresh one', async () => {
		// A stream whose every pull reads through MikroORM, as a filter or a `resolve` does.
		const stream: AsyncIterable<ExecutionResult> = {
			[Symbol.asyncIterator]: () => ({
				next: async () => {
					await touch('pull');
					return { value: { data: {} }, done: false };
				}
			})
		};

		const result = await runInOperationRequestContext(
			{ contextValue: {} } as ExecutionArgs,
			async () => {
				await touch('subscribe');
				// What the opener set on its fork is kept by every fork of it, as a filter parameter is.
				MikroOrmRequestContext.getEntityManager()?.setFilterParams('probe', { tenantId: TENANT_A });
				return stream;
			},
			mikroOrm.orm
		);
		const iterator = (result as AsyncIterable<ExecutionResult>)[Symbol.asyncIterator]();
		await iterator.next();
		await iterator.next();

		const [opened] = forksOf('subscribe');
		const pulls = forksOf('pull');
		expect(pulls).toHaveLength(2);
		expectDistinctForks([opened, ...pulls]);
		// Each pull forks the operation's own fork, not the global EntityManager.
		for (const fork of pulls) {
			expect(fork?.getFilterParams('probe')).toEqual({ tenantId: TENANT_A });
		}
	});

	it('opens no MikroORM context at all under TypeORM, and delivers exactly as before', async () => {
		process.env.DB_ORM = 'typeorm';
		const create = jest.spyOn(MikroOrmRequestContext, 'create');
		const socket = connect();

		await socket.send({ type: 'connection_init', payload: { Authorization: TOKEN_A } });
		await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { id } }' } });
		socket.subscribe('2', 'subscription { widgetChanged { id label } }');
		socket.subscribe('3', 'subscription { widgetStreamed { id } }');
		socket.subscribe('4', 'subscription { events(names: ["gadget.changed"]) { eventId } }');
		await until(() => forksOf('subscribe').length === 3);

		now += REAUTH_INTERVAL_MS;
		await pubSub.publish('widget.changed', TENANT_A, { id: 'w1', tenantId: TENANT_A });
		await pubSub.publish('widget.streamed', TENANT_A, {
			eventId: 'event-w2',
			name: 'widget.streamed',
			tenantId: TENANT_A,
			occurredAt: '2026-11-23T10:00:00.000Z',
			aggregate: { type: 'Widget', id: 'w2' },
			data: {}
		});
		await hub.publish({
			eventId: 'e1',
			name: 'gadget.changed',
			tenantId: TENANT_A,
			occurredAt: '2026-11-23T10:00:00.000Z',
			aggregate: { type: 'Gadget', id: 'g1' },
			data: {}
		});
		await until(() => ['2', '3', '4'].every((id) => socket.results(id).length === 1));
		await socket.end();

		expect(socket.results('1')).toEqual([{ data: { whoami: { id: USER_A.id } } }]);
		expect(socket.results('2')).toEqual([{ data: { widgetChanged: { id: 'w1', label: 'widget w1' } } }]);
		expect(socket.results('3')).toEqual([{ data: { widgetStreamed: { id: 'w2' } } }]);
		expect(socket.results('4')).toEqual([{ data: { events: { eventId: 'e1' } } }]);

		expect(create).not.toHaveBeenCalled();
		expect(seen.length).toBeGreaterThan(0);
		expect(seen.every((entry) => entry.em === undefined)).toBe(true);
	});
});
