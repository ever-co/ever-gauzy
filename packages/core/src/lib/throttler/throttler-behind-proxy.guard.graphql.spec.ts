import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
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
	providers: [PingResolver, { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }]
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

	const ping = (client = '203.0.113.10') =>
		request(app.getHttpServer()).post('/graphql').set('X-Forwarded-For', client).send({ query: '{ ping }' });

	it('answers a query, and states the rate limit on the HTTP response', async () => {
		const response = await ping();

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data).toEqual({ ping: 'pong' });
		expect(response.headers['x-ratelimit-limit']).toBe('2');
	});

	it('rate-limits GraphQL operations like REST routes', async () => {
		await ping(); // the second of the two allowed

		const third = await ping();

		expect(third.body.data ?? null).toBeNull();
		expect(JSON.stringify(third.body.errors)).toMatch(/Too Many Requests/i);
	});

	it('keeps one bucket per client, not one for every GraphQL caller', async () => {
		// The client above has spent its two; a different address has not.
		const other = await ping('198.51.100.20');

		expect(other.body.errors).toBeUndefined();
		expect(other.body.data).toEqual({ ping: 'pong' });
	});
});
