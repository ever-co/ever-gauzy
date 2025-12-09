import * as expressSession from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { environment } from '@gauzy/config';

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

			console.log('REDIS_URL: ', url);

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
					keepAlive: 10_000, // enable TCP keepalive (initial delay in ms)
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
				console.error('Failed to connect to Redis:', error);
			}

			const redisStore = new RedisStore({
				client: redisClient,
				prefix: environment.production ? 'gauzyprodsess:' : 'gauzydevsess:'
			});

			app.use(
				expressSession({
					store: redisStore,
					secret: environment.EXPRESS_SESSION_SECRET,
					resave: false, // Required for lightweight session keep alive (touch)
					saveUninitialized: true
					// cookie: { secure: true } // TODO: Enable if HTTPS is configured
				})
			);

			redisWorked = true;
		} catch (error) {
			console.error('Failed to initialize Redis session store:', error);
		}
	}

	if (!redisWorked) {
		app.use(
			expressSession({
				secret: environment.EXPRESS_SESSION_SECRET,
				resave: true, // Required as MemoryStore doesn't support `touch` method
				saveUninitialized: true
				// cookie: { secure: true } // TODO: Enable if HTTPS is configured
			})
		);
	}
}
