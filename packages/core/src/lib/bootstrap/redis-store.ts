import * as expressSession from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { environment } from '@gauzy/config';
import { redactUrlCredentials, redactUrlErrorInput } from '../core/util/redact-credentials';
import { resolveSessionStoreTimeout, withSessionStoreDeadline } from './session-store-deadline';

/**
 * Whether a session nobody wrote to is still stored (and a cookie set for it).
 *
 * It used to be `true`, which made EVERY request that arrived without a session cookie — every call
 * from the web app (CORS without credentials sends no cookie), the desktop timers, the SDKs and any
 * other API client, i.e. nearly all traffic — create a brand-new session and, before its response
 * could be written, store it: a Redis `SET` with a day-long TTL on the request path (express-session
 * defers `res.end` until the store answers), and with the in-memory fallback store an object that
 * stays in the API's heap for good. Nothing reads such a session: the sign-in flows that do use one
 * (OAuth 1 request tokens, OAuth 2 `state`, the MCP authorization server) write to it, and a session
 * that has been written to is saved exactly as before. `EXPRESS_SESSION_SAVE_UNINITIALIZED=true`
 * restores the previous behaviour.
 */
export function resolveSaveUninitialized(value: string | undefined): boolean {
	return String(value ?? '').trim().toLowerCase() === 'true';
}

/**
 * Sets up the Redis client with connection options and logs key events.
 * @param {object} options - The Redis connection options.
 * @returns {RedisClientType} - The configured Redis client instance.
 */
function createRedisClient(options: any) {
	const redisClient = createClient(options);

	// Define event handlers dynamically
	const events = {
		error: 'Redis Session Store Client Error',
		connect: 'Redis Session Store Client Connected',
		ready: 'Redis Session Store Client Ready',
		reconnecting: 'Redis Session Store Client Reconnecting',
		end: 'Redis Session Store Client End'
	};

	Object.entries(events).forEach(([event, message]) => {
		redisClient.on(event, () => {
			console.log(message);
		});
	});

	return redisClient;
}

/**
 * Wraps the session middleware so it is skipped for health probe routes.
 *
 * Probe requests carry no cookies, so with `saveUninitialized: true` (still available through
 * EXPRESS_SESSION_SAVE_UNINITIALIZED) every probe
 * would create a brand-new session, and — with the Redis store — express-session
 * defers the response until the session write settles. That would silently couple
 * the dependency-free liveness endpoint (`GET /api/health/live`) to Redis
 * availability (a Redis outage would hang the response past the probe timeout and
 * get healthy pods killed) and grows garbage session keys on every readiness probe.
 * Health routes never use sessions, so skipping is safe.
 *
 * @param middleware - The configured express-session middleware.
 * @returns A middleware that bypasses session handling for `/api/health*` routes.
 */
function skipSessionForHealthRoutes(middleware: any) {
	return (req: any, res: any, next: any) =>
		req.path === '/api/health' || req.path.startsWith('/api/health/') ? next() : middleware(req, res, next);
}

/**
 * Configures session store with Redis or falls back to in-memory session management.
 *
 * @param app - The Express application instance.
 * @param env - Environment variables for configuration.
 */
export async function configureRedisSession(app: any): Promise<void> {
	// Manage sessions with Redis or in-memory fallback
	let redisWorked = false;
	console.log('REDIS_ENABLED: ', process.env.REDIS_ENABLED);

	if (process.env.REDIS_ENABLED === 'true') {
		try {
			const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD, REDIS_TLS } = process.env;

			const url =
				REDIS_URL ||
				(() => {
					const redisProtocol = REDIS_TLS === 'true' ? 'rediss' : 'redis';
					const auth = REDIS_USER && REDIS_PASSWORD ? `${REDIS_USER}:${REDIS_PASSWORD}@` : '';
					return `${redisProtocol}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
				})();

			// Never log the raw URL: it carries the Redis password in its userinfo section.
			console.log('REDIS_URL: ', redactUrlCredentials(url));

			const parsedUrl = new URL(url);
			const isTls = parsedUrl.protocol === 'rediss:';
			const username = parsedUrl.username || REDIS_USER;
			const password = parsedUrl.password || REDIS_PASSWORD || undefined;
			const host = parsedUrl.hostname || REDIS_HOST;
			const port = parseInt(parsedUrl.port || REDIS_PORT || '6379', 10);

			const redisConnectionOptions = {
				url,
				username,
				password,
				isolationPoolOptions: {
					min: 1,
					max: 100
				},
				socket: {
					tls: isTls, // enable TLS only when using rediss:// (kept in sync)
					host,
					port,
					passphrase: password,
					// TCP keepalive: node-redis 5+ takes the switch and the initial delay (ms) as two options
					keepAlive: true,
					keepAliveInitialDelay: 10_000,
					reconnectStrategy: (retries: number) => Math.min(1000 * Math.pow(2, retries), 5000),
					connectTimeout: 10_000,
					rejectUnauthorized: process.env.NODE_ENV === 'production'
				},
				// Keep the socket from idling out at LB/firewall
				pingInterval: 30_000, // send PING every 30s
				ttl: 60 * 60 * 24 * 7 // 1 week
			};

			// Create a Redis client
			const redisClient = createRedisClient(redisConnectionOptions);

			try {
				// Connect to Redis
				await redisClient.connect();
				// Ping Redis
				console.log('Redis Session Store Client Sessions Ping: ', await redisClient.ping());
			} catch (error) {
				console.error('Failed to connect to Redis:', redactUrlErrorInput(error));
			}

			// Bounded, so that a Redis that stops answering (failover, maintenance, a half-open connection)
			// cannot hold every request of the API at once: see session-store-deadline.ts.
			const redisStore = withSessionStoreDeadline(
				new RedisStore({
					client: redisClient,
					prefix: environment.production ? 'gauzyprodsess:' : 'gauzydevsess:'
				}),
				resolveSessionStoreTimeout(process.env.REDIS_SESSION_TIMEOUT_MS)
			);

			app.use(
				skipSessionForHealthRoutes(
					expressSession({
						store: redisStore,
						secret: environment.EXPRESS_SESSION_SECRET,
						resave: false, // Required for lightweight session keep alive (touch)
						saveUninitialized: resolveSaveUninitialized(process.env.EXPRESS_SESSION_SAVE_UNINITIALIZED),
						// 'auto' sets the Secure flag only over HTTPS: on (prod/stage/demo run behind the proxy with
						// `trust proxy` enabled in bootstrap) and off on plain-HTTP local dev so sessions keep working there.
						cookie: { secure: 'auto' }
					})
				)
			);

			redisWorked = true;
		} catch (error) {
			console.error('Failed to initialize Redis session store:', redactUrlErrorInput(error));
		}
	}

	if (!redisWorked) {
		app.use(
			skipSessionForHealthRoutes(
				expressSession({
					secret: environment.EXPRESS_SESSION_SECRET,
					resave: true, // Required as MemoryStore doesn't support `touch` method
					saveUninitialized: resolveSaveUninitialized(process.env.EXPRESS_SESSION_SAVE_UNINITIALIZED),
					// 'auto' sets the Secure flag only over HTTPS: on (prod/stage/demo run behind the proxy with
					// `trust proxy` enabled in bootstrap) and off on plain-HTTP local dev so sessions keep working there.
					cookie: { secure: 'auto' }
				})
			)
		);
	}
}
