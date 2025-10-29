import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis, { createClient } from '@keyv/redis';
import { CacheService } from './cache.service';

/**
 * Cache Module using Keyv Redis adapter
 * Provides global caching functionality with Redis backend
 */
@Module({
	imports: [
		NestCacheModule.registerAsync({
			isGlobal: true,
			useFactory: async () => {
				// Build Redis URL from environment variables
				const url =
					process.env.REDIS_URL ||
					(process.env.REDIS_TLS === 'true'
						? `rediss://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
						: `redis://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

				// Parse Redis URL to extract connection details for advanced options
				let host: string | undefined;
				let port: string | number | undefined;
				let username: string | undefined;
				let password: string | undefined;
				const isTls = url.startsWith('rediss://');
				let authPart = url.split('://')[1];

				if (authPart.includes('@')) {
					const [userPass, hostPort] = authPart.split('@');
					[username, password] = userPass.split(':');
					[host, port] = hostPort.split(':');
				} else {
					[host, port] = authPart.split(':');
				}

				port = parseInt(port as string, 10);

				const redisConnectionOptions: Parameters<typeof createClient>[0] = {
					url,
					username,
					password,
					socket: isTls
						? {
								// TLS socket options (RedisTlsOptions)
								host,
								port,
								tls: true,
								rejectUnauthorized: process.env.NODE_ENV === 'production',
								// Reconnection strategy
								reconnectStrategy: (retries: number) => Math.min(1000 * Math.pow(2, retries), 5000),
								// Connection timeout
								connectTimeout: 10_000
						  }
						: {
								// TCP socket options (RedisSocketOptions)
								host,
								port,
								// TCP keepalive (value in milliseconds for initial delay)
								keepAlive: true,
								keepAliveInitialDelay: 10_000,
								// Reconnection strategy
								reconnectStrategy: (retries: number) => Math.min(1000 * Math.pow(2, retries), 5000),
								// Connection timeout
								connectTimeout: 10_000
						  },
					// Send PING every 30s to keep connection alive
					pingInterval: 30_000
				};

				// Create Redis client with production-ready connection options
				const redisClient = createClient(redisConnectionOptions);

				redisClient.on('connect', () => {
					console.log('Redis Cache Client Connected');
				});

				redisClient.on('ready', () => {
					console.log('Redis Cache Client Ready');
				});

				redisClient.on('reconnecting', () => {
					console.log('Redis Cache Client Reconnecting');
				});

				redisClient.on('end', () => {
					console.log('Redis Cache Client End');
				});
				redisClient.on('error', (err: any) => {
					console.error('Redis Cache Client Error', err);
				});
				// Ping Redis to verify connection
				try {
					await redisClient.connect();
					const res = await redisClient.ping();
					console.log('Redis Cache Client Ping:', res);
				} catch (error) {
					console.error('Failed to ping Redis:', error);
				}
				// Create KeyvRedis adapter with production-ready options
				const keyvRedis = new KeyvRedis(redisClient, {
					namespace: 'gauzy-cache',
					keyPrefixSeparator: ':',
					clearBatchSize: 1000,
					useUnlink: true,
					noNamespaceAffectsAll: false,
					throwOnConnectError: true,
					throwOnErrors: false
				});

				// Create Keyv instance with Redis adapter
				const keyv = new Keyv({ store: keyvRedis });

				// Handle connection errors
				keyv.on('error', (error: any) => {
					console.error('Redis Cache Client Error:', error);
				});
				return {
					stores: [keyv],
					ttl: 7 * 24 * 60 * 60 * 1000 // 1 week in milliseconds
				};
			}
		})
	],
	providers: [CacheService],
	exports: [CacheService]
})
export class CacheModule {}
