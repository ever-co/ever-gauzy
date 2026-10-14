/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules`: the same counter based
 * stub `feature-flag-resolution.spec.ts` uses keeps the module graph CommonJS.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

/**
 * 🛑 This import must stay before any import that pulls a core handler — the entity graph has to
 * finish initializing first. See the note in `invite/invite-accept.security.spec.ts`.
 */
import '../core/entities/internal';

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, GraphQLTypesLoader } from '@nestjs/graphql';
import { PassportStrategy } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as request from 'supertest';
import { RequestContext } from '../core/context/request-context';
import { RequestContextMiddleware } from '../core/context/request-context.middleware';
import { FeatureService } from '../feature/feature.service';
import { InviteController } from '../invite/invite.controller';
import { InviteResolver } from '../invite/invite.resolver';
import { InviteService } from '../invite/invite.service';
import { OrganizationTeamJoinRequestController } from '../organization-team-join-request/organization-team-join-request.controller';
import { OrganizationTeamJoinRequestResolver } from '../organization-team-join-request/organization-team-join-request.resolver';
import { OrganizationTeamJoinRequestService } from '../organization-team-join-request/organization-team-join-request.service';
import { RolePermissionService } from '../role-permission/role-permission.service';
import { AuthGuard } from '../shared/guards/auth.guard';
import { ThrottlerBehindProxyGuard } from '../throttler/throttler-behind-proxy.guard';
import { createGraphqlModuleOptions } from './graphql-helper';

/**
 * The `@Public()` GraphQL fields, end to end over HTTP.
 *
 * Every public field sits under `@FeatureFlag(FEATURE_GRAPHQL)` on its resolver class. A public handler
 * runs without the tenant guard, so the flag is resolved with no tenant — and that resolution read only
 * the deployment's configured toggles, which do not name `FEATURE_GRAPHQL`, so it answered `false` and
 * every public field was refused as `Cannot query field …` while the REST route it mirrors answered
 * (review R7-F3). Resolved from the catalogue default instead (`FEATURE_GRAPHQL` is on by default), the
 * fields answer — and then they are a second door to credentials the REST routes rate-limit: an invite
 * token or code, a join-request code. One HTTP request carrying aliases runs the field once per alias,
 * so without a per-field limit the batch is an amplifier (review R7-09). The fields now carry the
 * limits their REST twins carry, and the throttler guard counts every alias.
 *
 * The app below is the platform's own GraphQL wiring (`createGraphqlModuleOptions` over the shipped
 * schema snapshot), the platform's global `AuthGuard` and `ThrottlerBehindProxyGuard` as `APP_GUARD`s,
 * the real resolvers and the real `FeatureFlagGuard` → `FeatureService` chain. Only the services behind
 * the resolvers are doubles, and the feature catalogue repositories refuse to be read: with no tenant,
 * nothing stored may answer.
 */
describe('public GraphQL fields, over HTTP', () => {
	const SECRET = 'public-fields-spec-secret';
	const INVITE = { id: '00000000-0000-4000-8000-0000000000a1', email: 'invitee@example.com' };
	const JOIN_REQUEST = { id: '00000000-0000-4000-8000-0000000000b1', email: 'joiner@example.com' };

	/** The passport strategy the global `AuthGuard` authenticates with, named as the platform's is. */
	@Injectable()
	class SpecJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
		constructor() {
			super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET });
		}

		validate() {
			return false;
		}
	}

	/** A repository double that fails the test if anything reads it. */
	const unreadable = (name: string) =>
		new Proxy(
			{},
			{
				get: (_target, member) => {
					if (member === 'then') return undefined;
					return () => {
						throw new Error(`${name}.${String(member)} was read for a request that carries no tenant`);
					};
				}
			}
		);

	/** The in-memory cache `FeatureFlagGuard` stores its answers in. */
	const cache = new Map<string, unknown>();

	const queryBus = { execute: jest.fn(async () => INVITE) };
	const commandBus = { execute: jest.fn(async () => ({ affected: 1 })) };
	const joinRequests = { validateJoinRequest: jest.fn(async () => JOIN_REQUEST) };

	let app: INestApplication;

	beforeAll(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		const snapshot = readFileSync(path.join(__dirname, 'schema', 'schema.graphql'), 'utf8');
		const configService = { plugins: [], graphqlConfigOptions: {} } as unknown as ConfigService;
		const typesLoader = { mergeTypesByPaths: async () => snapshot } as unknown as GraphQLTypesLoader;

		const featureService = new FeatureService(
			unreadable('feature') as any,
			unreadable('mikroFeature') as any,
			unreadable('featureOrganization') as any,
			unreadable('mikroFeatureOrganization') as any
		);

		/** The resolvers under test, with the services behind them as doubles. */
		const resolverProviders = [
			InviteResolver,
			OrganizationTeamJoinRequestResolver,
			{ provide: InviteService, useValue: {} },
			{ provide: OrganizationTeamJoinRequestService, useValue: joinRequests },
			{ provide: QueryBus, useValue: queryBus },
			{ provide: CommandBus, useValue: commandBus },
			{ provide: FeatureService, useValue: featureService },
			{ provide: RolePermissionService, useValue: {} },
			{
				provide: CACHE_MANAGER,
				useValue: {
					get: async (key: string) => cache.get(key),
					set: async (key: string, value: unknown) => void cache.set(key, value)
				}
			}
		];

		class ResolverModule {}

		const moduleRef = await Test.createTestingModule({
			imports: [
				ClsModule.forRoot({ global: true, middleware: { mount: false } }),
				// A high installation-wide limit, as the shipped env files set: what stops a guesser is
				// the field's own limit, not this one.
				ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]),
				{ module: ResolverModule, providers: resolverProviders, exports: resolverProviders },
				GraphQLModule.forRootAsync<ApolloDriverConfig>({
					driver: ApolloDriver,
					useFactory: () =>
						createGraphqlModuleOptions(configService, typesLoader, {
							path: 'graphql',
							typePaths: [],
							playground: false,
							debug: false,
							resolverModule: ResolverModule
						} as GraphQLApiConfigurationOptions) as Promise<ApolloDriverConfig>
				})
			],
			providers: [
				SpecJwtStrategy,
				{ provide: APP_GUARD, useClass: AuthGuard },
				{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }
			]
		}).compile();

		app = moduleRef.createNestApplication({ logger: false });
		// As a deployment behind one proxy hop: Express derives `req.ip` from X-Forwarded-For.
		app.getHttpAdapter().getInstance().set('trust proxy', 1);

		// What `AppModule` and the bootstrap do: hand `RequestContext` the CLS service, and open a request
		// context for every HTTP request on the GraphQL endpoint.
		const cls = app.get(ClsService);
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		app.getHttpAdapter()
			.getInstance()
			.use('/graphql', (req: any, res: any, next: any) => middleware.use(req, res, next));

		await app.init();
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		RequestContext.setClsService(undefined as any);
		jest.restoreAllMocks();
	});

	/** One anonymous GraphQL request from one client address. */
	const graphql = (client: string, query: string, variables?: Record<string, unknown>) =>
		request(app.getHttpServer()).post('/graphql').set('X-Forwarded-For', client).send({ query, variables });

	describe('a public field answers an anonymous caller, as its REST route does (R7-F3)', () => {
		it('inviteByToken', async () => {
			const response = await graphql(
				'203.0.113.1',
				'query ($email: String!, $token: String!) { inviteByToken(email: $email, token: $token) { id } }',
				{ email: INVITE.email, token: 'a-token' }
			);

			expect(response.body.errors).toBeUndefined();
			expect(response.body.data).toEqual({ inviteByToken: { id: INVITE.id } });
		});

		it('inviteByCode', async () => {
			const response = await graphql(
				'203.0.113.2',
				'query ($email: String!, $code: String!) { inviteByCode(email: $email, code: $code) { id } }',
				{ email: INVITE.email, code: 'ABC123' }
			);

			expect(response.body.errors).toBeUndefined();
			expect(response.body.data).toEqual({ inviteByCode: { id: INVITE.id } });
		});

		it('validateOrganizationTeamJoinRequest', async () => {
			const response = await graphql(
				'203.0.113.3',
				`
					mutation ($input: ValidateOrganizationTeamJoinRequestInput!) {
						validateOrganizationTeamJoinRequest(input: $input) {
							id
						}
					}
				`,
				{
					input: {
						email: JOIN_REQUEST.email,
						organizationTeamId: '00000000-0000-4000-8000-0000000000c1',
						code: 'ABC123'
					}
				}
			);

			expect(response.body.errors).toBeUndefined();
			expect(response.body.data).toEqual({ validateOrganizationTeamJoinRequest: { id: JOIN_REQUEST.id } });
		});

		it('CONTROL: a field that is not public still refuses the same anonymous caller', async () => {
			// The global `AuthGuard` is live in this app; a public field passes it by being public, not
			// because nothing checks.
			const response = await graphql('203.0.113.4', '{ invites { __typename } }');

			expect(response.body.data ?? null).toBeNull();
			expect(JSON.stringify(response.body.errors)).toMatch(/Unauthorized/i);
		});
	});

	describe('a public field is rate-limited like its REST route, alias by alias (R7-09)', () => {
		it('serves ten guesses of an invite token a minute, however they are batched, and refuses the eleventh', async () => {
			const aliases = Array.from(
				{ length: 11 },
				(_, index) => `guess${index}: inviteByToken(email: "${INVITE.email}", token: "token-${index}") { id }`
			).join('\n');

			const response = await graphql('203.0.113.20', `{ ${aliases} }`);

			const answered = Object.values(response.body.data ?? {}).filter((value) => value !== null);
			expect(answered).toHaveLength(10);
			expect(response.body.errors).toHaveLength(1);
			expect(JSON.stringify(response.body.errors)).toMatch(/Too Many Requests/i);

			// Another client has spent nothing.
			const other = await graphql(
				'198.51.100.20',
				`{ inviteByToken(email: "${INVITE.email}", token: "t") { id } }`
			);
			expect(other.body.errors).toBeUndefined();
		});
	});

	describe('every public field carries the limit of the REST route it mirrors (R7-09)', () => {
		const limitOf = (handler: unknown) => Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler as object);
		const ttlOf = (handler: unknown) => Reflect.getMetadata(`${THROTTLER_TTL}default`, handler as object);

		it.each([
			[InviteResolver, 'inviteByToken', InviteController, 'validateInviteByToken'],
			[InviteResolver, 'inviteByCode', InviteController, 'validateInviteByCode'],
			[InviteResolver, 'acceptInvite', InviteController, 'acceptInvitation'],
			[InviteResolver, 'rejectInvite', InviteController, 'rejectInvitation'],
			[InviteResolver, 'acceptOrganizationContactInvite', InviteController, 'acceptOrganizationContactInvite'],
			[
				OrganizationTeamJoinRequestResolver,
				'createOrganizationTeamJoinRequest',
				OrganizationTeamJoinRequestController,
				'create'
			],
			[
				OrganizationTeamJoinRequestResolver,
				'validateOrganizationTeamJoinRequest',
				OrganizationTeamJoinRequestController,
				'validateJoinRequest'
			],
			[
				OrganizationTeamJoinRequestResolver,
				'resendOrganizationTeamJoinRequestCode',
				OrganizationTeamJoinRequestController,
				'resendConfirmationCode'
			]
		])('%p.%s', (resolver: any, field: string, controller: any, route: string) => {
			const fieldHandler = resolver.prototype[field];
			const routeHandler = controller.prototype[route];

			expect(typeof fieldHandler).toBe('function');
			expect(limitOf(routeHandler)).toEqual(expect.any(Number));
			expect(limitOf(fieldHandler)).toBe(limitOf(routeHandler));
			expect(ttlOf(fieldHandler)).toBe(ttlOf(routeHandler));
		});
	});
});
