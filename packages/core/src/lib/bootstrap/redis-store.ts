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
			const url =
				process.env.REDIS_URL ||
				(process.env.REDIS_TLS === 'true'
					? `rediss://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
					: `redis://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

			console.log('REDIS_URL: ', url);

			let host, port, username, password;

			const isTls = url.startsWith('rediss://');

			// Remove protocol part from URL
			let authPart = url.split('://')[1];

			if (authPart.includes('@')) {
				// Split user:password and host:port
				const [userPass, hostPort] = authPart.split('@');
				[username, password] = userPass.split(':');
				[host, port] = hostPort.split(':');
			} else {
				[host, port] = authPart.split(':');
			}

			port = parseInt(port, 10);

			const redisConnectionOptions = {
				url,
				username,
				password,
				isolationPoolOptions: {
					min: 1,
					max: 100
				},
				socket: {
					tls: isTls,
					host,
					port,
					passphrase: password,
					rejectUnauthorized: process.env.NODE_ENV === 'production'
				},
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
