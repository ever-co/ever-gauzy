import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ApolloDriver } from '@nestjs/apollo';
import { buildSchema } from 'graphql';
import { CloseCode, GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from 'graphql-ws';
import { ClsService } from 'nestjs-cls';
import { RequestContext } from '../../core/context/request-context';
import { TenantBaseGuard } from '../../shared/guards/tenant-base.guard';
import { GraphqlRequestContext, createGraphqlRequestContext } from '../graphql-context';
import { GraphqlTopicBroker, subscriptionTopic } from './graphql-pubsub.service';
import { bindToCurrentContext } from './subscription-request-context';
import { createSubscriptionServerOptions, graphqlContextArguments } from './subscription-transport';

/**
 * An operation on the subscription socket used to run with no request context: the store
 * `RequestContext` reads is opened by `RequestContextMiddleware`, which is Express middleware and never
 * sees a WebSocket message. `TenantPermissionGuard` therefore found no tenant and refused every
 * subscription, and a subscription's filter compared every event's tenant with null.
 *
 * These cases run the options the transport produces through `graphql-ws` itself, with the context
 * factory `graphql-helper.ts` installs, a real CLS service, the real `TenantBaseGuard` — the tenant
 * decision `TenantPermissionGuard` inherits — and the filter wrapper the Apollo driver puts around a
 * `@Subscription({ filter })`. Only the token check is a double: the `AuthGuard` resolves a bearer token
 * to a user and attaches it to the operation's request, and so does `authenticate` below.
 */
describe('the request context of a socket operation', () => {
	const TENANT_A = 'tenant-a';
	const TENANT_B = 'tenant-b';

	/** The users the two bearer tokens authenticate as, as `JwtStrategy` would attach them. */
	const USERS: Record<string, { id: string; tenantId: string; lastOrganizationId: string }> = {
		'Bearer token-a': { id: 'user-a', tenantId: TENANT_A, lastOrganizationId: 'organization-a' },
		'Bearer token-b': { id: 'user-b', tenantId: TENANT_B, lastOrganizationId: 'organization-b' }
	};

	/** The event name the subscription below streams. */
	const EVENT_NAME = 'widget.changed';

	const originalClsService = RequestContext['clsService'];
	let broker: GraphqlTopicBroker;
	/** What the guards were asked, per operation. */
	let seenByGuards: Array<{ tenantId: string | null; userId: string | null }>;

	/**
	 * What the global `AuthGuard` does with the operation's request: resolve the credential and attach
	 * the user to the request, which is where `RequestContext` reads it from.
	 */
	const authenticate = (req: { headers?: Record<string, string>; user?: unknown }): void => {
		const user = USERS[req?.headers?.['authorization'] ?? ''];

		if (!user) {
			throw new UnauthorizedException();
		}

		req.user = { ...user };
	};

	/**
	 * A field guarded the way the platform guards one: authenticated, then held to the tenant the
	 * credential carries by the real `TenantBaseGuard`, reading `RequestContext`.
	 */
	const guarded =
		<T>(resolver: (context: GraphqlRequestContext) => T) =>
		async (root: unknown, args: unknown, context: GraphqlRequestContext & { req: any }, info: unknown): Promise<T> => {
			authenticate(context.req);

			const host = new ExecutionContextHost([root, args, context, info]);
			host.setType('graphql');

			seenByGuards.push({ tenantId: RequestContext.currentTenantId(), userId: RequestContext.currentUserId() });

			if (!(await new TenantBaseGuard().canActivate(host))) {
				throw new ForbiddenException('Forbidden resource');
			}

			return resolver(context);
		};

	/**
	 * The schema: one query that reports what the operation's context holds, and one subscription
	 * written the way the platform's resolvers write one — the topic is the subscriber's tenant, and the
	 * filter compares each event's tenant with the subscriber's.
	 */
	const createSchema = () => {
		const schema = buildSchema(`
			type Query { whoami: Caller }
			type Caller { tenantId: ID, userId: ID, organizationId: ID, contextId: String, scope: Scope }
			type Scope { tenantId: ID, organizationId: ID }
			type Subscription { widgetChanged: Widget }
			type Widget { id: ID!, tenantId: ID! }
		`);

		const query = schema.getQueryType()!.getFields();
		query['whoami'].resolve = (root, args, context, info) =>
			guarded((operation) => ({
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId: RequestContext.currentOrganizationId(),
				contextId: RequestContext.getContextId(),
				// The scope a resolver reads from its GraphQL context, which is taken from the credential.
				scope: { tenantId: operation.tenantId, organizationId: operation.organizationId }
			}))(root, args, context, info);

		const subscription = schema.getSubscriptionType()!.getFields();
		// Exactly what `@Subscription('widgetChanged', { filter })` becomes under the Apollo driver.
		subscription['widgetChanged'].subscribe = ApolloDriver.prototype.subscriptionWithFilter(
			undefined,
			(payload: { tenantId?: string }) => Boolean(payload) && payload.tenantId === RequestContext.currentTenantId(),
			() =>
				guarded(() =>
					broker.asyncIterableIterator(subscriptionTopic(EVENT_NAME, String(RequestContext.currentTenantId() ?? '')))
				)
		);
		subscription['widgetChanged'].resolve = (payload: unknown) => payload;

		return schema;
	};

	/**
	 * Opens one connection on a `graphql-ws` server built from the transport's options, with the
	 * context factory `graphql-helper.ts` installs.
	 *
	 * @returns The messages the server sent, how it closed the socket, and a way to talk to it.
	 */
	const connect = (schema = createSchema()) => {
		const sent: any[] = [];
		/** Every close the server asked for, in order: a real socket stops at the first. */
		const closes: Array<number | undefined> = [];
		let receive: (data: string) => Promise<void> = async () => undefined;

		const server = makeServer({
			schema,
			context: (connection: unknown) => createGraphqlRequestContext(graphqlContextArguments(connection)),
			...createSubscriptionServerOptions()
		} as any);
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

		return {
			sent,
			closes,
			send: (message: unknown) => receive(JSON.stringify(message)),
			/** The payloads of the `next` messages of one operation. */
			results: (id: string) => sent.filter((message) => message.id === id && message.type === 'next').map((m) => m.payload),
			release: () => release(1000, 'done')
		};
	};

	/** Lets pending work run until a condition holds, without a timer. */
	const until = async (condition: () => boolean): Promise<void> => {
		for (let turn = 0; turn < 500 && !condition(); turn++) {
			await new Promise((resolve) => setImmediate(resolve));
		}

		expect(condition()).toBe(true);
	};

	beforeEach(() => {
		// The service the application installs: `ClsModule` hands the platform one backed by an
		// `AsyncLocalStorage`, and `AppModule` gives it to `RequestContext`.
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		broker = new GraphqlTopicBroker();
		seenByGuards = [];
	});

	afterEach(() => {
		broker.close();
		RequestContext['clsService'] = originalClsService;
	});

	describe('a query or a mutation', () => {
		it('is authenticated from the connection’s credential and scoped to its tenant', async () => {
			const socket = connect();

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-a' } });
			await socket.send({
				id: '1',
				type: 'subscribe',
				payload: { query: '{ whoami { tenantId userId organizationId scope { tenantId organizationId } } }' }
			});
			await socket.release();

			// With no request context the guard found no tenant and refused: the first message was an
			// error, not this.
			expect(socket.results('1')).toEqual([
				{
					data: {
						whoami: {
							tenantId: TENANT_A,
							userId: 'user-a',
							organizationId: 'organization-a',
							scope: { tenantId: TENANT_A, organizationId: 'organization-a' }
						}
					}
				}
			]);
			expect(seenByGuards).toEqual([{ tenantId: TENANT_A, userId: 'user-a' }]);
		});

		it('is refused when it states a tenant its credential does not carry, as on HTTP', async () => {
			const socket = connect();

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-a', 'Tenant-Id': TENANT_B } });
			await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { tenantId } }' } });
			await socket.release();

			const [result] = socket.results('1');

			// The guard compared the stated tenant with the credential's, which it can only do when it
			// can see the credential.
			expect(result.data).toEqual({ whoami: null });
			expect(result.errors?.[0]?.message).toBe('Forbidden resource');
			expect(seenByGuards).toEqual([{ tenantId: TENANT_A, userId: 'user-a' }]);
		});

		it('gets a context of its own, which does not outlive it and is not shared with the next one', async () => {
			const socket = connect();

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-a' } });
			await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { contextId } }' } });
			await socket.send({ id: '2', type: 'subscribe', payload: { query: '{ whoami { contextId } }' } });
			await socket.release();

			const [first] = socket.results('1');
			const [second] = socket.results('2');

			expect(first.data.whoami.contextId).toEqual(expect.any(String));
			expect(second.data.whoami.contextId).toEqual(expect.any(String));
			expect(first.data.whoami.contextId).not.toBe(second.data.whoami.contextId);
			// Nothing an operation put in its store is readable once it has finished.
			expect(RequestContext.currentRequestContext()).toBeUndefined();
			expect(RequestContext.currentTenantId()).toBeNull();
		});

		it('does not see the credential of another connection', async () => {
			const schema = createSchema();
			const first = connect(schema);
			const second = connect(schema);

			await first.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-a' } });
			await second.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-b' } });
			await Promise.all([
				first.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { tenantId userId } }' } }),
				second.send({ id: '1', type: 'subscribe', payload: { query: '{ whoami { tenantId userId } }' } })
			]);
			await first.release();
			await second.release();

			expect(first.results('1')).toEqual([{ data: { whoami: { tenantId: TENANT_A, userId: 'user-a' } } }]);
			expect(second.results('1')).toEqual([{ data: { whoami: { tenantId: TENANT_B, userId: 'user-b' } } }]);
		});
	});

	describe('a subscription', () => {
		it('delivers its own tenant’s events and not another tenant’s', async () => {
			const schema = createSchema();
			const subscriberA = connect(schema);
			const subscriberB = connect(schema);
			const query = 'subscription { widgetChanged { id tenantId } }';

			await subscriberA.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-a' } });
			await subscriberB.send({ type: 'connection_init', payload: { Authorization: 'Bearer token-b' } });

			// Each subscription stays inside `graphql-ws`'s delivery loop until it completes, so the
			// messages are sent and not awaited.
			const openA = subscriberA.send({ id: 's', type: 'subscribe', payload: { query } });
			const openB = subscriberB.send({ id: 's', type: 'subscribe', payload: { query } });

			const topicA = subscriptionTopic(EVENT_NAME, TENANT_A);
			const topicB = subscriptionTopic(EVENT_NAME, TENANT_B);

			// Before the fix the guard refused both, so neither topic was ever opened.
			await until(() => broker.subscriberCount(topicA) === 1 && broker.subscriberCount(topicB) === 1);
			expect(seenByGuards).toEqual(
				expect.arrayContaining([
					{ tenantId: TENANT_A, userId: 'user-a' },
					{ tenantId: TENANT_B, userId: 'user-b' }
				])
			);

			broker.publish(topicA, { id: 'a-1', tenantId: TENANT_A });
			broker.publish(topicB, { id: 'b-1', tenantId: TENANT_B });
			// An event on the wrong topic: the filter is the second line, and it must hold on its own.
			broker.publish(topicA, { id: 'b-2', tenantId: TENANT_B });
			broker.publish(topicA, { id: 'a-2', tenantId: TENANT_A });

			await until(() => subscriberA.results('s').length === 2 && subscriberB.results('s').length === 1);

			await subscriberA.send({ id: 's', type: 'complete' });
			await subscriberB.send({ id: 's', type: 'complete' });
			await Promise.all([openA, openB]);
			await subscriberA.release();
			await subscriberB.release();

			expect(subscriberA.results('s')).toEqual([
				{ data: { widgetChanged: { id: 'a-1', tenantId: TENANT_A } } },
				{ data: { widgetChanged: { id: 'a-2', tenantId: TENANT_A } } }
			]);
			expect(subscriberB.results('s')).toEqual([{ data: { widgetChanged: { id: 'b-1', tenantId: TENANT_B } } }]);
			// Completing the operation closed the stream it opened.
			expect(broker.subscriberCount(topicA)).toBe(0);
			expect(broker.subscriberCount(topicB)).toBe(0);
		});

		it('is refused by the guards when the credential authenticates nobody', async () => {
			const socket = connect();

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer revoked' } });
			await socket.send({ id: 's', type: 'subscribe', payload: { query: 'subscription { widgetChanged { id } }' } });
			await socket.release();

			const [result] = socket.results('s');

			expect(result.errors?.[0]?.message).toBe('Unauthorized');
			expect(broker.topics()).toEqual([]);
		});

		it('is never opened on a socket that presented no credential', async () => {
			const socket = connect();

			await socket.send({ type: 'connection_init', payload: {} });
			await socket.send({ id: 's', type: 'subscribe', payload: { query: 'subscription { widgetChanged { id } }' } });
			await socket.release();

			expect(socket.closes[0]).toBe(CloseCode.Forbidden);
			expect(socket.sent).toEqual([]);
			expect(seenByGuards).toEqual([]);
		});
	});

	describe('bindToCurrentContext', () => {
		it('runs every pull of a stream inside the context it was bound in, whoever pulls', async () => {
			const als = new AsyncLocalStorage<string>();
			const seen: Array<string | undefined> = [];

			async function* stream() {
				seen.push(als.getStore());
				yield 1;
				seen.push(als.getStore());
				yield 2;
			}

			const bound = als.run('operation', () => bindToCurrentContext(stream()));

			// Pulled from outside the store, as `graphql-ws`'s loop pulls.
			const values: number[] = [];
			for await (const value of bound) {
				values.push(value);
			}

			expect(values).toEqual([1, 2]);
			expect(seen).toEqual(['operation', 'operation']);
		});

		it('closes the stream it wraps', async () => {
			const returned = jest.fn(async () => ({ value: undefined, done: true as const }));
			const stream = {
				next: async () => ({ value: 1, done: false as const }),
				return: returned,
				[Symbol.asyncIterator]() {
					return this;
				}
			};

			await bindToCurrentContext(stream).return?.(undefined);

			expect(returned).toHaveBeenCalledTimes(1);
		});
	});
});
