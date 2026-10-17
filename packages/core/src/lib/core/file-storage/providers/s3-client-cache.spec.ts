import { S3Client } from '@aws-sdk/client-s3';
import {
	cachedPresign,
	clearS3Caches,
	getCachedS3Client,
	getCachedSignedUrl,
	s3ClientCacheKey,
	signedUrlCacheSeconds
} from './s3-client-cache';

const config = (secret = 'secret-a', region = 'us-east-1') => ({
	region,
	credentials: { accessKeyId: 'AKIA1', secretAccessKey: secret },
	forcePathStyle: true
});

describe('s3-client-cache', () => {
	const env = { ...process.env };

	afterEach(() => {
		clearS3Caches();
		process.env = { ...env };
	});

	it('shares one client per configuration, and never across different credentials or regions', () => {
		const a = getCachedS3Client(config());
		expect(a).toBeInstanceOf(S3Client);
		expect(getCachedS3Client(config())).toBe(a);
		expect(getCachedS3Client(config('secret-b'))).not.toBe(a);
		expect(getCachedS3Client(config('secret-a', 'eu-west-1'))).not.toBe(a);
	});

	it('never puts the secret itself in a cache key', () => {
		expect(s3ClientCacheKey(config('very-secret-value'))).not.toContain('very-secret-value');
	});

	it('signs an object once while its URL is fresh, and shares an in-flight signature', async () => {
		let signed = 0;
		const sign = () => new Promise<string>((resolve) => setTimeout(() => resolve(`url-${++signed}`), 5));
		const [a, b] = await Promise.all([getCachedSignedUrl('k', sign, 1000), getCachedSignedUrl('k', sign, 1000)]);
		expect([a, b]).toEqual(['url-1', 'url-1']);
		await expect(getCachedSignedUrl('k', sign, 2000)).resolves.toBe('url-1');
		// After the cache window (600 s by default) the URL is signed again.
		await expect(getCachedSignedUrl('k', sign, 1000 + 601_000)).resolves.toBe('url-2');
		expect(signed).toBe(2);
	});

	it('does not cache a failed signature', async () => {
		const failing = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
		await expect(getCachedSignedUrl('k2', failing)).rejects.toThrow('boom');
		await expect(getCachedSignedUrl('k2', failing)).resolves.toBe('ok');
	});

	it('signs every time when FILE_STORAGE_SIGNED_URL_CACHE_SECONDS=0, and caps the window below the URL lifetime', async () => {
		process.env.FILE_STORAGE_SIGNED_URL_CACHE_SECONDS = '0';
		const sign = jest.fn().mockResolvedValue('u');
		await getCachedSignedUrl('k3', sign);
		await getCachedSignedUrl('k3', sign);
		expect(sign).toHaveBeenCalledTimes(2);
		expect(signedUrlCacheSeconds({ FILE_STORAGE_SIGNED_URL_CACHE_SECONDS: '999999' })).toBe(3000);
		expect(signedUrlCacheSeconds({})).toBe(600);
	});

	it('keys presigned URLs by client, bucket and object', async () => {
		const client = getCachedS3Client(config());
		const other = getCachedS3Client(config('secret-b'));
		const sign = jest.fn().mockImplementation(async () => `u${sign.mock.calls.length}`);
		const first = await cachedPresign(client, 'bucket', 'a.png', sign);
		expect(await cachedPresign(client, 'bucket', 'a.png', sign)).toBe(first);
		expect(await cachedPresign(client, 'bucket', 'b.png', sign)).not.toBe(first);
		expect(await cachedPresign(client, 'other-bucket', 'a.png', sign)).not.toBe(first);
		expect(await cachedPresign(other, 'bucket', 'a.png', sign)).not.toBe(first);
		// A client this module did not create is never cached.
		const foreign = new S3Client(config());
		await cachedPresign(foreign, 'bucket', 'a.png', sign);
		await cachedPresign(foreign, 'bucket', 'a.png', sign);
		expect(sign).toHaveBeenCalledTimes(6);
	});
});
