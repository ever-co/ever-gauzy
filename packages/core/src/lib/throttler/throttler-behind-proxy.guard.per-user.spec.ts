import { Controller, Get, HttpStatus, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { sign } from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import * as request from 'supertest';
import { environment } from '@gauzy/config';
import { Public } from '@gauzy/common';
import { ACCESS_TOKEN_TYPE } from '../access-token/type.token';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';
import {
	EVER_CLIENT_IP_HEADER,
	EVER_CLIENT_IP_SIGNATURE_HEADER,
	EVER_CLIENT_IP_TIMESTAMP_HEADER
} from './tracker';

/**
 * Owner decision 16 (Ever Teams rate limiting), end to end through the guard as `AppModule` registers it:
 *
 * - On a route that requires authentication, a request whose access token verifies is counted in its
 *   user's bucket: two users behind one address (an office, or the Ever Teams server that calls the API
 *   for all its users) no longer share one budget, and one user does not get a new budget per address.
 * - A token that does not verify is counted by address, like an anonymous request.
 * - An anonymous (`@Public()`) route is counted by address even when a valid token is sent.
 * - With `EVER_TEAMS_CLIENT_IP_SECRET` set, the address is the browser's, forwarded by the Ever Teams server
 *   with an HMAC proof; without a valid proof the headers are ignored, never refused.
 *
 * Only the bucket is under test, so the platform's `AuthGuard` is not mounted. The limit is 2 per route.
 */
@Controller('spec-throttle')
class SpecThrottleController {
	/** A route that requires authentication (no `@Public()`). */
	@Get('signed-in')
	signedIn(): string {
		return 'ok';
	}

	/** An anonymous route, like sign-in, invite accept or password reset. */
	@Public()
	@Get('anonymous')
	anonymous(): string {
		return 'ok';
	}
}

@Module({
	imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
	controllers: [SpecThrottleController],
	providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }]
})
class SpecThrottleModule {}

describe('ThrottlerBehindProxyGuard: per-user buckets and the address forwarded by Ever Teams', () => {
	const TEAMS_SECRET = 'guard-spec-teams-secret-0123456789abcdef';
	const originalClientIpSecret = environment.EVER_TEAMS_CLIENT_IP_SECRET;
	const originalTrustCf = environment.THROTTLE_TRUST_CF_CONNECTING_IP;

	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [SpecThrottleModule] }).compile();
		app = moduleRef.createNestApplication({ logger: false });
		// As a deployment behind one proxy hop: Express derives `req.ip` from X-Forwarded-For.
		app.getHttpAdapter().getInstance().set('trust proxy', 1);
		await app.init();
	});

	beforeEach(() => {
		environment.EVER_TEAMS_CLIENT_IP_SECRET = undefined;
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = false;
	});

	afterEach(() => {
		environment.EVER_TEAMS_CLIENT_IP_SECRET = originalClientIpSecret;
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = originalTrustCf;
	});

	afterAll(async () => {
		await app?.close();
	});

	/** An access token for `id`, signed the way `JwtStrategy` verifies it (`JWT_SECRET`, HS256). */
	const tokenFor = (id: string, secret: string = environment.JWT_SECRET) => {
		const claims = { id, tenantId: 'tenant-1', tokenType: ACCESS_TOKEN_TYPE };
		return sign(claims, secret, { algorithm: 'HS256', expiresIn: 600 });
	};

	/** The headers the Ever Teams server adds for the browser at `browserIp`. */
	const forwardedBy = (browserIp: string, secret = TEAMS_SECRET) => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = createHmac('sha256', secret).update(`${timestamp}.${browserIp}`).digest('hex');
		return {
			[EVER_CLIENT_IP_HEADER]: browserIp,
			[EVER_CLIENT_IP_TIMESTAMP_HEADER]: timestamp,
			[EVER_CLIENT_IP_SIGNATURE_HEADER]: signature
		};
	};

	/** One GET from `address`, optionally signed in and with extra headers; resolves to the status code. */
	const call = async (
		route: 'signed-in' | 'anonymous',
		address: string,
		options: { token?: string; headers?: Record<string, string> } = {}
	): Promise<number> => {
		let pending = request(app.getHttpServer()).get(`/spec-throttle/${route}`).set('X-Forwarded-For', address);
		if (options.token) {
			pending = pending.set('Authorization', `Bearer ${options.token}`);
		}
		for (const [name, value] of Object.entries(options.headers ?? {})) {
			pending = pending.set(name, value);
		}
		return (await pending).status;
	};

	describe('signed-in routes', () => {
		it('counts two users behind one address in separate buckets', async () => {
			const office = '203.0.113.30';
			const alice = tokenFor('user-alice');
			const bob = tokenFor('user-bob');

			expect(await call('signed-in', office, { token: alice })).toBe(HttpStatus.OK);
			expect(await call('signed-in', office, { token: alice })).toBe(HttpStatus.OK);
			expect(await call('signed-in', office, { token: alice })).toBe(HttpStatus.TOO_MANY_REQUESTS);

			// Bob shares Alice's address but not her budget.
			expect(await call('signed-in', office, { token: bob })).toBe(HttpStatus.OK);
		});

		it('keeps one user in one bucket whatever address the request comes from', async () => {
			const carol = tokenFor('user-carol');

			expect(await call('signed-in', '198.51.100.1', { token: carol })).toBe(HttpStatus.OK);
			expect(await call('signed-in', '198.51.100.2', { token: carol })).toBe(HttpStatus.OK);
			expect(await call('signed-in', '198.51.100.3', { token: carol })).toBe(HttpStatus.TOO_MANY_REQUESTS);

			// CONTROL: the third address itself has spent nothing.
			expect(await call('signed-in', '198.51.100.3')).toBe(HttpStatus.OK);
		});

		it('counts a forged or expired token by address, so it cannot name a fresh bucket', async () => {
			const address = '203.0.113.31';
			const forged = (n: number) => tokenFor(`user-forged-${n}`, `attacker-secret-${n}-0123456789abcdef`);
			const expired = sign(
				{ id: 'user-dave', tokenType: ACCESS_TOKEN_TYPE, exp: Math.floor(Date.now() / 1000) - 60 },
				environment.JWT_SECRET,
				{ algorithm: 'HS256' }
			);

			expect(await call('signed-in', address, { token: forged(1) })).toBe(HttpStatus.OK);
			expect(await call('signed-in', address, { token: expired })).toBe(HttpStatus.OK);
			expect(await call('signed-in', address, { token: forged(2) })).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(await call('signed-in', address)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});
	});

	describe('anonymous routes', () => {
		it('count per address even when a valid token is sent', async () => {
			const address = '203.0.113.32';

			expect(await call('anonymous', address, { token: tokenFor('user-erin') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', address, { token: tokenFor('user-frank') })).toBe(HttpStatus.OK);
			// More accounts buy no more attempts from one address.
			expect(await call('anonymous', address, { token: tokenFor('user-grace') })).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);
			expect(await call('anonymous', address)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('count each browser behind the Ever Teams server by the address it forwards with a proof', async () => {
			environment.EVER_TEAMS_CLIENT_IP_SECRET = TEAMS_SECRET;
			const teamsServer = '203.0.113.40';

			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.1') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.1') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.1') })).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);

			// Another browser behind the same Ever Teams server has its own budget...
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.2') })).toBe(HttpStatus.OK);
			// ...and so has the Ever Teams server's own address.
			expect(await call('anonymous', teamsServer)).toBe(HttpStatus.OK);
		});

		it('also trust the forwarded address over CF-Connecting-IP, which names the Ever Teams server', async () => {
			environment.EVER_TEAMS_CLIENT_IP_SECRET = TEAMS_SECRET;
			environment.THROTTLE_TRUST_CF_CONNECTING_IP = true;
			const viaCloudflare = (browserIp: string) => ({
				...forwardedBy(browserIp),
				'CF-Connecting-IP': '203.0.113.41'
			});

			expect(await call('anonymous', '10.0.0.1', { headers: viaCloudflare('192.0.2.5') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', '10.0.0.1', { headers: viaCloudflare('192.0.2.5') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', '10.0.0.1', { headers: viaCloudflare('192.0.2.6') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', '10.0.0.1', { headers: viaCloudflare('192.0.2.5') })).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);
		});

		it('ignore the forwarded address without a valid proof, and never refuse the request for it', async () => {
			environment.EVER_TEAMS_CLIENT_IP_SECRET = TEAMS_SECRET;
			const teamsServer = '203.0.113.42';
			const wrongSecret = 'not-the-teams-secret-0123456789abcdef';

			// A wrong proof is ignored (not a 4xx): the request is counted by the address the API sees.
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.10', wrongSecret) })).toBe(
				HttpStatus.OK
			);
			expect(
				await call('anonymous', teamsServer, {
					headers: { [EVER_CLIENT_IP_HEADER]: '192.0.2.11' }
				})
			).toBe(HttpStatus.OK);
			// Both landed in the Ever Teams server's bucket, which is now spent.
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.12', wrongSecret) })).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);
		});

		it('ignore even a valid proof while EVER_TEAMS_CLIENT_IP_SECRET is unset', async () => {
			const teamsServer = '203.0.113.43';

			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.20') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.21') })).toBe(HttpStatus.OK);
			expect(await call('anonymous', teamsServer, { headers: forwardedBy('192.0.2.22') })).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);
		});
	});
});
