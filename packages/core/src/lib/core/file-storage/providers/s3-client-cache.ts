import { createHash } from 'node:crypto';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * Shared S3 clients and presigned URLs for the S3-compatible file storage providers (S3, Wasabi, DigitalOcean).
 *
 * Every provider used to build a NEW `S3Client` for every URL it presigned. Image assets, screenshots,
 * documents and videos presign their URLs in their entity's `afterLoad` hook, and a user's avatar is an eager
 * relation of the user — so this ran for every row of every list that shows people, organizations, projects,
 * teams or screenshots, and for the authenticated user of EVERY request (the JWT strategy loads it). An
 * `S3Client` constructor resolves its whole runtime configuration and middleware stack and allocates its own
 * HTTP and HTTPS agents: hundreds of microseconds to milliseconds of synchronous CPU per URL, all of it inside
 * the database query's load hooks, i.e. while the query's pooled connection is still checked out.
 *
 * Clients are now kept per distinct configuration (credentials included, so per-tenant storage settings never
 * share a client), and a presigned URL is reused for a while instead of being signed again on every read. A
 * reused URL is never closer than {@link PRESIGNED_URL_MIN_REMAINING_SECONDS} to its expiry, and because the
 * same object now keeps the same URL for minutes, browsers can finally cache avatars and thumbnails.
 */

/** How long a URL is signed for (unchanged: one hour). */
export const PRESIGNED_URL_EXPIRES_IN_SECONDS = 3600;

/**
 * How long a signed URL is served from the cache: 10 minutes by default, so a returned URL always has at least
 * 50 minutes of validity left. `FILE_STORAGE_SIGNED_URL_CACHE_SECONDS=0` signs every URL afresh, as before.
 */
export function signedUrlCacheSeconds(env: NodeJS.ProcessEnv = process.env): number {
	const parsed = Number.parseInt(String(env.FILE_STORAGE_SIGNED_URL_CACHE_SECONDS ?? ''), 10);
	const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 600;
	return Math.min(value, PRESIGNED_URL_EXPIRES_IN_SECONDS - PRESIGNED_URL_MIN_REMAINING_SECONDS);
}

/** A cached URL is never handed out with less validity than this. */
export const PRESIGNED_URL_MIN_REMAINING_SECONDS = 600;

const MAX_CLIENTS = 64;
/** How long an evicted client stays usable by whoever still holds it (uploads of up to 50 MB included). */
export const EVICTED_CLIENT_DESTROY_DELAY_MS = 15 * 60 * 1000;
const MAX_URLS = 20_000;

const clients = new Map<string, S3Client>();
const clientKeys = new WeakMap<S3Client, string>();
const urls = new Map<string, { url: string; until: number }>();
const inFlight = new Map<string, Promise<string>>();

function fingerprint(secret: string | undefined): string {
	return secret ? createHash('sha256').update(secret).digest('hex').slice(0, 16) : '';
}

/**
 * The cache key of a client configuration. The secret is only ever present as a truncated hash.
 */
export function s3ClientCacheKey(config: S3ClientConfig): string {
	const credentials = config.credentials as { accessKeyId?: string; secretAccessKey?: string } | undefined;
	return JSON.stringify([
		String(config.endpoint ?? ''),
		String(config.region ?? ''),
		!!config.forcePathStyle,
		credentials?.accessKeyId ?? '',
		fingerprint(credentials?.secretAccessKey)
	]);
}

/**
 * The shared client for a configuration, created on first use. Only plain configurations (static credentials,
 * string endpoint/region) are expected here, which is what the providers build.
 */
export function getCachedS3Client(config: S3ClientConfig): S3Client {
	const key = s3ClientCacheKey(config);
	let client = clients.get(key);
	if (client) {
		// Refresh its position, so the least recently used client is the one evicted.
		clients.delete(key);
		clients.set(key, client);
		return client;
	}
	client = new S3Client(config);
	clients.set(key, client);
	clientKeys.set(client, key);
	if (clients.size > MAX_CLIENTS) {
		const [oldestKey, oldest] = clients.entries().next().value as [string, S3Client];
		clients.delete(oldestKey);
		// Not destroyed at once: callers keep the client across async work (an upload streaming through
		// multer-s3, a download whose body is read later), and destroy() closes the sockets in use. It leaves the
		// cache now and is destroyed once anything it was serving has long finished.
		const timer = setTimeout(() => {
			try {
				oldest.destroy();
			} catch {
				// A client being destroyed has nothing left to report.
			}
		}, EVICTED_CLIENT_DESTROY_DELAY_MS);
		timer.unref?.();
	}
	return client;
}

/**
 * Return the cached presigned URL for `key`, or sign one with `sign` (concurrent requests for the same key share
 * one signature). `key` must identify the object AND everything that changes the URL (provider, endpoint,
 * region, bucket, access key).
 */
export async function getCachedSignedUrl(key: string, sign: () => Promise<string>, now: number = Date.now()): Promise<string> {
	const ttlSeconds = signedUrlCacheSeconds();
	if (ttlSeconds <= 0) {
		return sign();
	}
	const cached = urls.get(key);
	if (cached && cached.until > now) {
		return cached.url;
	}
	const pending = inFlight.get(key);
	if (pending) {
		return pending;
	}
	const promise = (async () => {
		try {
			const url = await sign();
			if (url) {
				urls.delete(key);
				urls.set(key, { url, until: now + ttlSeconds * 1000 });
				if (urls.size > MAX_URLS) {
					urls.delete(urls.keys().next().value as string);
				}
			}
			return url;
		} finally {
			inFlight.delete(key);
		}
	})();
	inFlight.set(key, promise);
	return promise;
}

/**
 * Cache key of a presigned GET URL: the client's configuration (endpoint, region, path style, access key and a
 * hash of the secret), the bucket and the object key. A client not created by {@link getCachedS3Client} gets no
 * key, and its URLs are then not cached.
 */
export function signedUrlCacheKey(client: S3Client, bucket: string | null | undefined, objectKey: string): string | null {
	const clientKey = clientKeys.get(client);
	return clientKey ? JSON.stringify([clientKey, bucket ?? '', objectKey]) : null;
}

/**
 * Presign a GET for `objectKey` with `client`, reusing a recent signature of the same object (see
 * {@link getCachedSignedUrl}).
 */
export function cachedPresign(
	client: S3Client,
	bucket: string | null | undefined,
	objectKey: string,
	sign: () => Promise<string>
): Promise<string> {
	const key = signedUrlCacheKey(client, bucket, objectKey);
	return key ? getCachedSignedUrl(key, sign) : sign();
}

/** Test helper: forget every cached client and URL. */
export function clearS3Caches(): void {
	for (const client of clients.values()) {
		try {
			client.destroy();
		} catch {
			// ignore
		}
	}
	clients.clear();
	urls.clear();
	inFlight.clear();
}
