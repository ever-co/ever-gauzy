import * as jwt from 'jsonwebtoken';

// The middleware only uses the service as a DI token plus two methods; loading the real one would pull in
// the whole entity graph for a unit test.
jest.mock('./tenant-setting.service', () => ({ TenantSettingService: class {} }));
// The secret the API signs its access tokens with.
jest.mock('@gauzy/config', () => ({ environment: { JWT_SECRET: 'test-secret' } }));

import {
	EMPTY_TENANT_SETTINGS_TTL_MS,
	TENANT_SETTINGS_TTL_MS,
	TenantSettingsMiddleware
} from './tenant-settings.middleware';

/**
 * `TenantSettingsMiddleware` runs on every route. A request costs one cache read; when a tenant's entry has
 * expired, the requests that miss together share one load of two queries, and the request fields it attaches
 * are the same as they always were.
 */
describe('TenantSettingsMiddleware', () => {
	const TENANT = 'tenant-1';
	const bearer = (payload: object) => `Bearer ${jwt.sign(payload, 'test-secret')}`;

	function build(options: { global?: Record<string, any>; tenant?: Record<string, any> } = {}) {
		const cache = new Map<string, { value: unknown; ttl: number }>();
		const cacheManager = {
			get: jest.fn(async (key: string) => cache.get(key)?.value),
			set: jest.fn(async (key: string, value: unknown, ttl: number) => {
				cache.set(key, { value, ttl });
			})
		};
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const tenantSettingService = {
			getGlobalSettings: jest.fn(async () => {
				await gate;
				return options.global ?? {};
			}),
			getSettings: jest.fn(async () => {
				await gate;
				return options.tenant ?? {};
			})
		};
		const middleware = new TenantSettingsMiddleware(cacheManager as any, tenantSettingService as any);
		const run = (authorization?: string) => {
			const request: any = { headers: authorization ? { authorization } : {}, path: '/api/x', url: '/api/x' };
			const next = jest.fn();
			return { request, next, done: middleware.use(request, {} as any, next) };
		};
		return { middleware, cacheManager, cache, tenantSettingService, run, release: () => release() };
	}

	it('attaches the tenant settings and the resolved (global overridden by tenant) settings', async () => {
		const { run, release } = build({
			global: { fileStorageProvider: 'LOCAL', aws_bucket: 'global' },
			tenant: { aws_bucket: 'tenant' }
		});
		const { request, next, done } = run(bearer({ tenantId: TENANT }));
		release();
		await done;

		expect(request.tenantSettings).toEqual({ aws_bucket: 'tenant' });
		expect(request.resolvedSettings).toEqual({ fileStorageProvider: 'LOCAL', aws_bucket: 'tenant' });
		expect(next).toHaveBeenCalledTimes(1);
	});

	it('runs the two queries once and caches the bundle for five minutes, then answers from one cache read', async () => {
		const { run, release, cacheManager, cache, tenantSettingService } = build({ tenant: { aws_bucket: 'b' } });
		release();
		await run(bearer({ tenantId: TENANT })).done;
		await run(bearer({ tenantId: TENANT })).done;

		expect(tenantSettingService.getGlobalSettings).toHaveBeenCalledTimes(1);
		expect(tenantSettingService.getSettings).toHaveBeenCalledTimes(1);
		expect(tenantSettingService.getSettings).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
		expect(cacheManager.set).toHaveBeenCalledTimes(1);
		expect([...cache.values()][0].ttl).toBe(TENANT_SETTINGS_TTL_MS);
		// One read per request: both requests, one key.
		expect(cacheManager.get).toHaveBeenCalledTimes(2);
	});

	it('shares one load between the requests of a tenant that miss together', async () => {
		const { run, release, tenantSettingService, middleware } = build({ tenant: { aws_bucket: 'b' } });
		const requests = [1, 2, 3, 4].map(() => run(bearer({ tenantId: TENANT })));
		await new Promise((resolve) => setImmediate(resolve));
		expect(tenantSettingService.getSettings).toHaveBeenCalledTimes(1);

		release();
		await Promise.all(requests.map(({ done }) => done));

		for (const { request } of requests) {
			expect(request.tenantSettings).toEqual({ aws_bucket: 'b' });
		}
		expect((middleware as any).loading.size).toBe(0);
	});

	it('keeps the tenants apart when two of them miss together on the same instance', async () => {
		const { run, release, tenantSettingService, cacheManager } = build({
			global: { fileStorageProvider: 'LOCAL' }
		});
		const perTenant: Record<string, Record<string, any>> = {
			'tenant-1': { aws_bucket: 'bucket-one' },
			'tenant-2': { aws_bucket: 'bucket-two' }
		};
		(tenantSettingService.getSettings as jest.Mock).mockImplementation(async ({ where }: any) => {
			await new Promise((resolve) => setImmediate(resolve));
			return perTenant[where.tenantId];
		});

		const first = [run(bearer({ tenantId: 'tenant-1' })), run(bearer({ tenantId: 'tenant-2' }))];
		const second = [run(bearer({ tenantId: 'tenant-1' })), run(bearer({ tenantId: 'tenant-2' }))];
		release();
		await Promise.all([...first, ...second].map(({ done }) => done));

		// One load per tenant, shared by that tenant's waiting requests only.
		expect(tenantSettingService.getSettings).toHaveBeenCalledTimes(2);
		for (const { request } of [first[0], second[0]]) {
			expect(request.tenantSettings).toEqual({ aws_bucket: 'bucket-one' });
			expect(request.resolvedSettings).toEqual({ fileStorageProvider: 'LOCAL', aws_bucket: 'bucket-one' });
		}
		for (const { request } of [first[1], second[1]]) {
			expect(request.tenantSettings).toEqual({ aws_bucket: 'bucket-two' });
			expect(request.resolvedSettings).toEqual({ fileStorageProvider: 'LOCAL', aws_bucket: 'bucket-two' });
		}

		// And the later cache hits are each tenant's own entry.
		const later = [run(bearer({ tenantId: 'tenant-1' })), run(bearer({ tenantId: 'tenant-2' }))];
		await Promise.all(later.map(({ done }) => done));
		expect(tenantSettingService.getSettings).toHaveBeenCalledTimes(2);
		expect(cacheManager.set).toHaveBeenCalledTimes(2);
		expect(later[0].request.tenantSettings).toEqual({ aws_bucket: 'bucket-one' });
		expect(later[1].request.tenantSettings).toEqual({ aws_bucket: 'bucket-two' });
	});

	it('keeps an empty answer for one minute only, and attaches no resolved settings for it', async () => {
		const { run, release, cache } = build();
		release();
		const { request, done } = run(bearer({ tenantId: TENANT }));
		await done;

		expect(request.tenantSettings).toEqual({});
		expect(request.resolvedSettings).toBeUndefined();
		expect([...cache.values()][0].ttl).toBe(EMPTY_TENANT_SETTINGS_TTL_MS);
	});

	it('attaches empty tenant settings for a token without a tenant, and nothing without a token', async () => {
		const { run, tenantSettingService } = build();
		const withoutTenant = run(bearer({ id: 'user-1' }));
		await withoutTenant.done;
		expect(withoutTenant.request.tenantSettings).toEqual({});
		expect(withoutTenant.request.resolvedSettings).toBeUndefined();

		const anonymous = run();
		await anonymous.done;
		expect(anonymous.request.tenantSettings).toBeUndefined();
		expect(anonymous.next).toHaveBeenCalledTimes(1);
		expect(tenantSettingService.getSettings).not.toHaveBeenCalled();
	});

	it.each([
		['signed with another secret', jwt.sign({ tenantId: TENANT }, 'not-the-api-secret')],
		['unsigned', jwt.sign({ tenantId: TENANT }, '', { algorithm: 'none' } as jwt.SignOptions)],
		['expired', jwt.sign({ tenantId: TENANT, exp: Math.floor(Date.now() / 1000) - 60 }, 'test-secret')],
		['minted for another flow', jwt.sign({ tenantId: TENANT, purpose: 'password-reset' }, 'test-secret')],
		['not a JWT', 'garbage']
	])('names no tenant with a token %s, and reads nothing for it', async (_label, token) => {
		const { run, release, tenantSettingService, cacheManager } = build({ tenant: { aws_bucket: 'theirs' } });
		release();
		const { request, next, done } = run(`Bearer ${token}`);
		await done;

		expect(request.tenantSettings).toEqual({});
		expect(request.resolvedSettings).toBeUndefined();
		expect(tenantSettingService.getSettings).not.toHaveBeenCalled();
		expect(cacheManager.get).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
	});

	it('still calls next when the settings cannot be read', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const { run, tenantSettingService, middleware } = build();
			tenantSettingService.getSettings.mockRejectedValue(new Error('database is away'));
			tenantSettingService.getGlobalSettings.mockRejectedValue(new Error('database is away'));
			const { request, next, done } = run(bearer({ tenantId: TENANT }));
			await done;

			expect(next).toHaveBeenCalledTimes(1);
			expect(request.tenantSettings).toBeUndefined();
			expect((middleware as any).loading.size).toBe(0);
		} finally {
			consoleError.mockRestore();
		}
	});
});
