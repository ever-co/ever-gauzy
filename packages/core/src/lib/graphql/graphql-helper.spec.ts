import { AsyncLocalStorage } from 'async_hooks';
import { GqlModuleOptions, GraphQLTypesLoader } from '@nestjs/graphql';
import { DocumentNode, ExecutionArgs, GraphQLError, GraphQLSchema, buildSchema, parse } from 'graphql';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@gauzy/config';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { createGraphqlModuleOptions } from './graphql-helper';

/**
 * The options the driver is built from. These cases pin the three that were wired to nothing: the
 * persisted-query switch the configuration declares, the rules the subscription socket validates
 * with, and the context a socket operation is given.
 */
describe('createGraphqlModuleOptions', () => {
	const SDL = 'type Query { hello: String }';

	/** The options the driver is handed, for a deployment configured as stated. */
	const build = async (
		graphqlConfigOptions: Record<string, unknown> = {},
		apiOptions: Partial<GraphQLApiConfigurationOptions> = {}
	): Promise<GqlModuleOptions & Record<string, any>> => {
		const configService = { plugins: [], graphqlConfigOptions } as unknown as ConfigService;
		const typesLoader = { mergeTypesByPaths: jest.fn(async () => SDL) } as unknown as GraphQLTypesLoader;

		return (await createGraphqlModuleOptions(configService, typesLoader, {
			path: 'graphql',
			typePaths: [],
			playground: true,
			debug: false,
			resolverModule: class HostModule {},
			...apiOptions
		} as GraphQLApiConfigurationOptions)) as GqlModuleOptions & Record<string, any>;
	};

	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('persisted queries', () => {
		it('accepts them when the shipped configuration asks for them', async () => {
			// `graphqlConfigOptions.persistedQueries` is declared and documented, and was read by nothing.
			expect((await build({ persistedQueries: true })).persistedQueries).toEqual({});
		});

		it('refuses them when the configuration says nothing', async () => {
			expect((await build()).persistedQueries).toBe(false);
		});
	});

	describe('the subscription socket', () => {
		const socketOptions = async (apiOptions: Partial<GraphQLApiConfigurationOptions> = {}) => {
			const options = await build({}, apiOptions);

			return options.subscriptions?.['graphql-ws'] as {
				onConnect: (context: unknown) => boolean;
				validate: (schema: GraphQLSchema, document: DocumentNode) => ReadonlyArray<GraphQLError>;
				execute: (args: ExecutionArgs) => Promise<unknown>;
				subscribe: (args: ExecutionArgs) => Promise<unknown>;
			};
		};

		it('is served, because the transport package is installed', async () => {
			expect(await socketOptions()).toEqual(expect.objectContaining({ onConnect: expect.any(Function) }));
		});

		it('validates an operation with the rules the HTTP transport applies', async () => {
			// The playground is off, so introspection is off — and an introspection query sent over the
			// socket used to be answered anyway, because the socket validated with the specification's
			// rules alone.
			const { validate } = await socketOptions({ playground: false });
			const errors = validate(buildSchema(SDL), parse('{ __schema { queryType { name } } }'));

			expect(errors.map((error) => error.extensions?.code)).toContain(ApiErrorCode.GRAPHQL_INTROSPECTION_DISABLED);
			expect(validate(buildSchema(SDL), parse('{ hello }'))).toEqual([]);
		});

		it('closes a connection that presents no credential', async () => {
			const { onConnect } = await socketOptions();

			expect(onConnect({ connectionParams: {}, extra: {} })).toBe(false);
			expect(onConnect({ connectionParams: { Authorization: 'Bearer token' }, extra: {} })).toBe(true);
		});

		it('runs an operation inside a request context built from the operation’s request', async () => {
			// `RequestContextMiddleware` opens the request context for HTTP only, so an operation on the
			// socket used to run with none: the guards found no tenant and refused every subscription.
			const originalClsService = RequestContext['clsService'];
			RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));

			try {
				const { execute, subscribe } = await socketOptions();
				const req = { headers: {}, user: { id: 'user-1', tenantId: 'tenant-1' } };

				const result = await execute({
					schema: buildSchema(SDL),
					document: parse('{ hello }'),
					rootValue: { hello: () => RequestContext.currentTenantId() },
					contextValue: { req }
				});

				expect(result).toEqual({ data: { hello: 'tenant-1' } });
				expect(subscribe).toEqual(expect.any(Function));
			} finally {
				RequestContext['clsService'] = originalClsService;
			}
		});
	});

	describe('the operation context', () => {
		it('keeps the request of an HTTP operation', async () => {
			const { context } = await build();
			const req = { headers: { authorization: 'Bearer token' } };

			expect((await context({ req, res: {} })).req).toBe(req);
		});

		it('gives a socket operation a request carrying the connection’s credential', async () => {
			// The driver hands a socket operation the graphql-ws connection context, which has no `req`.
			// Destructuring `{ req }` built a context with no request, and the `AuthGuard` then found no
			// headers to read a credential from.
			const { context } = await build();
			const operation = await context({
				connectionParams: { Authorization: 'Bearer token', 'X-Channel-Id': 'web', Cookie: 'ignored' },
				extra: { request: { headers: {} } }
			});

			expect(operation.req.headers).toEqual({ authorization: 'Bearer token', 'x-channel-id': 'web' });
			expect(operation.req.header('Authorization')).toBe('Bearer token');
			expect(operation.channelId).toBe('web');
		});
	});
});
