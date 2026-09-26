import { AddressInfo } from 'node:net';
import { INestApplication, Injectable, Module, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, GraphQLTypesLoader, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PassportStrategy } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { Client, createClient } from 'graphql-ws';
import { sign } from 'jsonwebtoken';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestContext } from '../../core/context/request-context';
import { RequestContextMiddleware } from '../../core/context/request-context.middleware';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { TenantBaseGuard } from '../../shared/guards/tenant-base.guard';
import { createGraphqlModuleOptions } from '../graphql-helper';
import { GraphqlPubSub } from './graphql-pubsub.service';

/**
 * The subscription socket, end to end: a Nest application configured by `createGraphqlModuleOptions`,
 * served by the Apollo driver, with a client talking `graphql-ws` to it over a real WebSocket.
 *
 * Everything between the socket and the resolver is the platform's own or the framework's: the
 * transport options, the context factory, the driver's subscription service, the global `AuthGuard`
 * verifying a signed bearer token through passport, `TenantBaseGuard` — the tenant decision
 * `TenantPermissionGuard` inherits — and a `@Subscription({ filter })` written as the platform's
 * resolvers write one. The one stand-in is the strategy's user lookup, which reads the database in the
 * application and a table here.
 *
 * Before the socket's operations were given a request context, the guard found no tenant on the socket
 * and every subscription was refused: nothing below reached a subscriber.
 */
describe('the subscription socket, end to end', () => {
	const SECRET = 'subscription-socket-spec-secret';
	const TENANT_A = 'tenant-a';
	const TENANT_B = 'tenant-b';
	const EVENT_NAME = 'widget.changed';

	/** The users the tokens name, as `JwtStrategy` attaches them after reading the database. */
	const USERS: Record<string, { id: string; tenantId: string; lastOrganizationId: string }> = {
		'user-a': { id: 'user-a', tenantId: TENANT_A, lastOrganizationId: 'organization-a' },
		'user-b': { id: 'user-b', tenantId: TENANT_B, lastOrganizationId: 'organization-b' }
	};

	/** A signed access token for one user. */
	const tokenFor = (userId: string, secret = SECRET) => `Bearer ${sign({ id: userId }, secret)}`;

	/** The passport strategy the global `AuthGuard` authenticates with, named as the platform's is. */
	@Injectable()
	class SpecJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
		constructor() {
			super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET });
		}

		validate(payload: { id: string }) {
			const user = USERS[payload.id];

			return user ? { ...user } : false;
		}
	}

	@Resolver()
	@UseGuards(TenantBaseGuard)
	class WidgetResolver {
		constructor(private readonly pubSub: GraphqlPubSub) {}

		@Query('whoami')
		whoami() {
			return {
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId: RequestContext.currentOrganizationId()
			};
		}

		@Subscription('widgetChanged', {
			filter: (payload: { tenantId?: string }) =>
				Boolean(payload) && payload.tenantId === RequestContext.currentTenantId(),
			resolve: (payload: unknown) => payload
		})
		widgetChanged() {
			return this.pubSub.asyncIterableIterator(
				this.pubSub.topicFor(EVENT_NAME, String(RequestContext.currentTenantId() ?? ''))
			);
		}
	}

	@Module({ providers: [WidgetResolver, GraphqlPubSub], exports: [GraphqlPubSub] })
	class WidgetModule {}

	const SDL = `
		type Query { whoami: Caller }
		type Caller { tenantId: ID, userId: ID, organizationId: ID }
		type Subscription { widgetChanged: Widget }
		type Widget { id: ID!, tenantId: ID! }
	`;

	let app: INestApplication;
	let pubSub: GraphqlPubSub;
	let url: string;
	const clients: Client[] = [];

	/**
	 * A `graphql-ws` client over a real WebSocket — the runtime's own, which the client uses when it is
	 * given none — presenting the given connection parameters.
	 */
	const connect = (connectionParams: Record<string, unknown>): Client => {
		const client = createClient({ url, connectionParams, retryAttempts: 0, lazy: true });
		clients.push(client);
		return client;
	};

	/** Runs one query or mutation over the socket. */
	const operate = (client: Client, query: string) =>
		new Promise<any>((resolve, reject) => {
			let result: unknown;
			client.subscribe({ query }, { next: (value) => (result = value), error: reject, complete: () => resolve(result) });
		});

	/** Waits, on the real clock, until a condition holds. */
	const until = async (condition: () => boolean, timeoutMs = 5000): Promise<void> => {
		const deadline = Date.now() + timeoutMs;

		while (!condition() && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(condition()).toBe(true);
	};

	beforeAll(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		const configService = { plugins: [], graphqlConfigOptions: {} } as unknown as ConfigService;
		const typesLoader = { mergeTypesByPaths: async () => SDL } as unknown as GraphQLTypesLoader;

		const moduleRef = await Test.createTestingModule({
			imports: [
				ClsModule.forRoot({ global: true, middleware: { mount: false } }),
				WidgetModule,
				GraphQLModule.forRootAsync<ApolloDriverConfig>({
					driver: ApolloDriver,
					useFactory: () =>
						createGraphqlModuleOptions(configService, typesLoader, {
							path: 'graphql',
							typePaths: [],
							playground: false,
							debug: false,
							resolverModule: WidgetModule
						} as GraphQLApiConfigurationOptions) as Promise<ApolloDriverConfig>
				})
			],
			providers: [SpecJwtStrategy, TenantBaseGuard, { provide: APP_GUARD, useClass: AuthGuard }]
		}).compile();

		app = moduleRef.createNestApplication({ logger: false });

		// What `AppModule` and the bootstrap do: hand `RequestContext` the CLS service, and open a request
		// context for every HTTP request on the GraphQL endpoint.
		const cls = app.get(ClsService);
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		app.getHttpAdapter()
			.getInstance()
			.use('/graphql', (req, res, next) => middleware.use(req, res, next));

		await app.listen(0, '127.0.0.1');

		const { port } = app.getHttpServer().address() as AddressInfo;
		url = `ws://127.0.0.1:${port}/graphql`;
		pubSub = app.get(GraphqlPubSub);
	}, 60_000);

	afterEach(async () => {
		await Promise.all(clients.splice(0).map((client) => client.dispose()));
	});

	afterAll(async () => {
		await app?.close();
		RequestContext.setClsService(undefined as any);
		jest.restoreAllMocks();
	});

	it('answers a query on the socket exactly as it answers the same query over HTTP', async () => {
		const query = '{ whoami { tenantId userId organizationId } }';
		const expected = { data: { whoami: { tenantId: TENANT_A, userId: 'user-a', organizationId: 'organization-a' } } };

		const overHttp = await fetch(url.replace('ws://', 'http://'), {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: tokenFor('user-a') },
			body: JSON.stringify({ query })
		}).then((response) => response.json());

		const overSocket = await operate(connect({ Authorization: tokenFor('user-a') }), query);

		expect(overHttp).toEqual(expected);
		expect(overSocket).toEqual(expected);
	});

	it('delivers a subscriber its own tenant’s events and not another tenant’s', async () => {
		const received: Record<string, unknown[]> = { [TENANT_A]: [], [TENANT_B]: [] };
		const failures: unknown[] = [];
		const query = 'subscription { widgetChanged { id tenantId } }';

		const unsubscribe = [TENANT_A, TENANT_B].map((tenantId) =>
			connect({ Authorization: tokenFor(tenantId === TENANT_A ? 'user-a' : 'user-b') }).subscribe(
				{ query },
				{
					next: (value) => received[tenantId].push(value),
					error: (error) => failures.push(error),
					complete: () => undefined
				}
			)
		);

		// Both guards passed and both resolvers opened their tenant's topic.
		await until(() => pubSub.openStreams === 2 || failures.length > 0);
		expect(failures).toEqual([]);

		await pubSub.publish(EVENT_NAME, TENANT_A, { id: 'a-1', tenantId: TENANT_A });
		await pubSub.publish(EVENT_NAME, TENANT_B, { id: 'b-1', tenantId: TENANT_B });
		// An event on the wrong topic: the filter is the second line, and it must hold on its own.
		await pubSub.publish(EVENT_NAME, TENANT_A, { id: 'b-2', tenantId: TENANT_B });
		await pubSub.publish(EVENT_NAME, TENANT_A, { id: 'a-2', tenantId: TENANT_A });

		await until(() => received[TENANT_A].length === 2 && received[TENANT_B].length === 1);
		unsubscribe.forEach((stop) => stop());

		expect(received[TENANT_A]).toEqual([
			{ data: { widgetChanged: { id: 'a-1', tenantId: TENANT_A } } },
			{ data: { widgetChanged: { id: 'a-2', tenantId: TENANT_A } } }
		]);
		expect(received[TENANT_B]).toEqual([{ data: { widgetChanged: { id: 'b-1', tenantId: TENANT_B } } }]);

		// Completing the subscriptions closed the streams they opened.
		await until(() => pubSub.openStreams === 0);
	});

	it('refuses a subscription whose stated tenant the credential does not carry', async () => {
		const result = await operate(
			connect({ Authorization: tokenFor('user-a'), 'Tenant-Id': TENANT_B }),
			'subscription { widgetChanged { id } }'
		);

		// The guard compared the stated tenant with the authenticated one, which it can only do when it
		// sees the credential.
		expect(result.errors?.[0]?.message).toBe('Forbidden resource');
		expect(pubSub.openStreams).toBe(0);
	});

	it('refuses a subscription whose token does not verify', async () => {
		const result = await operate(
			connect({ Authorization: tokenFor('user-a', 'another-secret') }),
			'subscription { widgetChanged { id } }'
		);

		expect(result.errors?.[0]?.message).toBe('Unauthorized');
		expect(pubSub.openStreams).toBe(0);
	});

	it('still closes a socket that presents no credential', async () => {
		const closed = await new Promise<{ code?: number }>((resolve) => {
			connect({}).subscribe(
				{ query: 'subscription { widgetChanged { id } }' },
				{ next: () => undefined, error: (event) => resolve(event as { code?: number }), complete: () => resolve({}) }
			);
		});

		expect(closed.code).toBe(4403);
	});
});
