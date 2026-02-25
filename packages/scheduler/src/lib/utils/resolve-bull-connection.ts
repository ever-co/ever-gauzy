import { ConnectionOptions } from 'bullmq';

export function resolveBullConnection(connection?: ConnectionOptions): ConnectionOptions {
	if (connection) {
		return connection;
	}

	if (process.env['REDIS_URL']) {
		return parseRedisUrl(process.env['REDIS_URL']);
	}

	return {
		host: process.env['REDIS_HOST'] || '127.0.0.1',
		port: parsePort(process.env['REDIS_PORT'], 6379),
		username: process.env['REDIS_USER'] || undefined,
		password: process.env['REDIS_PASSWORD'] || undefined,
		...(process.env['REDIS_TLS'] === 'true' ? { tls: {} } : {})
	};
}

function parseRedisUrl(redisUrl: string): ConnectionOptions {
	const parsed = new URL(redisUrl);
	const isTls = parsed.protocol === 'rediss:' || process.env['REDIS_TLS'] === 'true';

	return {
		host: parsed.hostname,
		port: parsePort(parsed.port, 6379),
		username: parsed.username || undefined,
		password: parsed.password || undefined,
		...(isTls ? { tls: {} } : {})
	};
}

function parsePort(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}
