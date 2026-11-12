/**
 * The import's background storage work (the `docs.import` run, the stalled-import sweep) runs with the tenant's own
 * storage settings: a tenant can keep its own bucket, which the storage providers read from a request the queue thread
 * does not have.
 */
const applied: Array<Record<string, unknown> | null | undefined> = [];

jest.mock('@gauzy/core', () => ({
	TenantSettingService: class {},
	runWithTenantStorageSettings: async (settings: Record<string, unknown> | null | undefined, work: () => Promise<unknown>) => {
		applied.push(settings);
		return work();
	}
}));

import { IMPORT_TENANT_SETTINGS_TTL_MS, ImportTenantStorage } from './import-tenant-storage';

function build(read: () => Promise<Record<string, unknown>>) {
	const tenantSettings = { getSettings: jest.fn(read) };
	return { storage: new ImportTenantStorage(tenantSettings as never), tenantSettings };
}

describe('ImportTenantStorage', () => {
	beforeEach(() => {
		applied.length = 0;
		jest.useRealTimers();
	});

	it('applies the tenant settings to the work and answers what the work answers', async () => {
		const { storage, tenantSettings } = build(async () => ({ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' }));

		await expect(storage.run('tenant-1', async () => 'zip bytes')).resolves.toBe('zip bytes');
		expect(applied).toEqual([{ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' }]);
		expect(tenantSettings.getSettings).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
	});

	it('reads the settings of a tenant once a minute, not once per file', async () => {
		jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
		const { storage, tenantSettings } = build(async () => ({ aws_bucket: 'tenant-bucket' }));

		await storage.run('tenant-1', async () => undefined);
		await storage.run('tenant-1', async () => undefined);
		expect(tenantSettings.getSettings).toHaveBeenCalledTimes(1);

		jest.setSystemTime(new Date(Date.now() + IMPORT_TENANT_SETTINGS_TTL_MS + 1));
		await storage.run('tenant-1', async () => undefined);
		expect(tenantSettings.getSettings).toHaveBeenCalledTimes(2);
	});

	it('uses the deployment defaults without a tenant', async () => {
		const { storage, tenantSettings } = build(async () => ({ aws_bucket: 'tenant-bucket' }));

		await storage.run(null, async () => undefined);
		expect(applied).toEqual([{}]);
		expect(tenantSettings.getSettings).not.toHaveBeenCalled();
	});

	it('does not fall back to the deployment bucket when the settings cannot be read', async () => {
		const { storage } = build(async () => {
			throw new Error('database went away');
		});
		const work = jest.fn(async () => undefined);

		await expect(storage.run('tenant-1', work)).rejects.toThrow('database went away');
		expect(work).not.toHaveBeenCalled();
	});
});
