import { docsRateLimit, docsRateLimitTracker } from './docs.config';

/**
 * The Documents routes' throttle key.
 *
 * It used to fall back to the client-supplied `tenant-id` HEADER whenever `req.user` carried no
 * tenant, so a caller could name a fresh bucket per request by varying that header — the same class
 * of defect as GHSA-86mw-2crg-vmhc. Only verified identity or the Express-resolved address may key
 * a bucket.
 */
describe('docsRateLimitTracker', () => {
	it('keys an authenticated user by tenant and user from the verified token', () => {
		expect(
			docsRateLimitTracker({
				user: { tenantId: 't1', id: 'u1' },
				ip: '203.0.113.10',
				headers: { 'tenant-id': 'x' }
			})
		).toBe('docs:t1:u1');
	});

	it('never lets a tenant-id header choose the bucket', () => {
		const buckets = new Set<string>();

		for (let attempt = 0; attempt < 25; attempt++) {
			buckets.add(docsRateLimitTracker({ ip: '203.0.113.10', headers: { 'tenant-id': `tenant-${attempt}` } }));
			buckets.add(
				docsRateLimitTracker({
					user: { id: 'u1' },
					ip: '203.0.113.10',
					headers: { 'tenant-id': `tenant-${attempt}` }
				})
			);
		}

		expect(buckets).toEqual(new Set(['docs:unauthenticated:203.0.113.10']));
	});

	it('shares one bucket when not even an address is known', () => {
		expect(docsRateLimitTracker({ headers: {} })).toBe('docs:unauthenticated:unresolved-client');
		expect(docsRateLimitTracker(undefined as any)).toBe('docs:unauthenticated:unresolved-client');
	});

	it('is the tracker the route throttle options use', () => {
		expect(docsRateLimit(10).default.getTracker).toBe(docsRateLimitTracker);
	});
});
