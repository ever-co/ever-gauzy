import { ExecutionContext, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import * as request from 'supertest';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

/**
 * With `THROTTLE_ENABLED=true` (stage sets it) the throttler is a global `APP_GUARD`, so it also runs
 * for every GraphQL resolver. `ThrottlerGuard` reads the request and response through
 * `switchToHttp()`, which on a GraphQL context answers the ROOT VALUE and the field-arguments object.
 * So the bucket key was built from a root value with no address — every GraphQL client of the
 * deployment shared ONE bucket, and once anyone spent the limit everyone was refused — and no
 * rate-limit header ever reached the response (review R7-06; on @nestjs/throttler 6.7 the header
 * write is guarded, so it was not the crash the review read from an older release). This boots the
 * guard exactly as `AppModule` registers it and sends real HTTP from two client addresses.
 */
/** The guard instance the app registered, for the direct `canActivate` cases. */
const APP_GUARD_INSTANCE = 'THROTTLER_GUARD_UNDER_TEST';

@Resolver()
class PingResolver {
	@Query(() => String)
	ping(): string {
		return 'pong';
	}
}

@Module({
	imports: [
		ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }]),
		GraphQLModule.forRoot<ApolloDriverConfig>({
			driver: ApolloDriver,
			autoSchemaFile: true,
			// Mirrors `graphql-helper.ts`: the operation context carries the Express request.
			context: ({ req }: { req: unknown }) => ({ req })
		})
	],
	providers: [
		PingResolver,
		ThrottlerBehindProxyGuard,
		{ provide: APP_GUARD_INSTANCE, useExisting: ThrottlerBehindProxyGuard },
		{ provide: APP_GUARD, useExisting: ThrottlerBehindProxyGuard }
	]
})
class ThrottledGraphqlModule {}

describe('ThrottlerBehindProxyGuard on GraphQL operations', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ThrottledGraphqlModule] }).compile();
		app = moduleRef.createNestApplication();
		// As a deployment behind one proxy hop: Express derives `req.ip` from X-Forwarded-For.
		app.getHttpAdapter().getInstance().set('trust proxy', 1);
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
	});

	/** A GraphQL execution context whose operation context carries `req` (or nothing). */
	const graphqlContext = (operationContext: Record<string, unknown>): ExecutionContext => {
		const host = new ExecutionContextHost([undefined, {}, operationContext, {}], PingResolver, PingResolver.prototype.ping);
		host.setType('graphql');
		return host;
	};

	it.each([
		['no request at all', {}],
		['an upgrade request without a response (graphql-ws)', { req: { headers: {}, socket: {} } }]
	])('lets a socket-delivered operation through without spending an allowance: %s', async (_label, operationContext) => {
		const guard = app.get(APP_GUARD_INSTANCE);
		const storage = app.get(ThrottlerStorage);
		const increment = jest.spyOn(storage, 'increment');

		await expect(guard.canActivate(graphqlContext(operationContext))).resolves.toBe(true);
		expect(increment).not.toHaveBeenCalled();
		increment.mockRestore();
	});

	const ping = (client: string) =>
		request(app.getHttpServer()).post('/graphql').set('X-Forwarded-For', client).send({ query: '{ ping }' });

	it('answers a query, and states the rate limit on the HTTP response', async () => {
		const response = await ping('203.0.113.10');

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data).toEqual({ ping: 'pong' });
		expect(response.headers['x-ratelimit-limit']).toBe('2');
	});

	it('rate-limits GraphQL operations like REST routes', async () => {
		const client = '203.0.113.11';
		await ping(client);
		await ping(client); // the two allowed

		const third = await ping(client);

		expect(third.body.data ?? null).toBeNull();
		expect(JSON.stringify(third.body.errors)).toMatch(/Too Many Requests/i);
	});

	it('keeps one bucket per client, not one for every GraphQL caller', async () => {
		const spender = '203.0.113.12';
		await ping(spender);
		await ping(spender);
		expect(JSON.stringify((await ping(spender)).body.errors)).toMatch(/Too Many Requests/i);

		// Another address has spent nothing.
		const other = await ping('198.51.100.20');

		expect(other.body.errors).toBeUndefined();
		expect(other.body.data).toEqual({ ping: 'pong' });
	});
});
