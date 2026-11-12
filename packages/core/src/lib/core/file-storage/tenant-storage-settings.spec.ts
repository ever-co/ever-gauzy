import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { RequestContext } from '../context/request-context';
import { runWithTenantStorageSettings } from './tenant-storage-settings';

/**
 * Background storage work (a queue job, a sweep) runs with no signed-in request, so the storage providers, which read
 * a tenant's own bucket and credentials from the request, fell back to the deployment's defaults.
 */
describe('runWithTenantStorageSettings', () => {
	const originalClsService = RequestContext['clsService'];

	beforeEach(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
	});

	it('shows the tenant settings to the storage work, and only to it', async () => {
		const seen = await runWithTenantStorageSettings({ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' }, async () => {
			await Promise.resolve();
			return RequestContext.currentRequest()?.['tenantSettings'];
		});

		expect(seen).toEqual({ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' });
		expect(RequestContext.currentRequest()).toBeNull();
	});

	it('grants no user and keeps an enclosing request out', async () => {
		const outer = { headers: {}, user: { id: 'user-1', tenantId: 'tenant-1' }, tenantSettings: { aws_bucket: 'other' } };

		const seen = await RequestContext.runWithRequest(outer as never, () =>
			runWithTenantStorageSettings({ aws_bucket: 'tenant-bucket' }, async () => ({
				userId: RequestContext.currentUserId(),
				tenantId: RequestContext.currentTenantId(),
				settings: RequestContext.currentRequest()?.['tenantSettings']
			}))
		);

		expect(seen).toEqual({ userId: null, tenantId: null, settings: { aws_bucket: 'tenant-bucket' } });
		expect(outer.tenantSettings).toEqual({ aws_bucket: 'other' });
	});

	it('keeps concurrent runs apart', async () => {
		const run = (bucket: string) =>
			runWithTenantStorageSettings({ aws_bucket: bucket }, async () => {
				await new Promise((resolve) => setImmediate(resolve));
				return RequestContext.currentRequest()?.['tenantSettings']?.['aws_bucket'];
			});

		expect(await Promise.all([run('bucket-a'), run('bucket-b')])).toEqual(['bucket-a', 'bucket-b']);
	});

	it('runs with the defaults when the tenant has no settings', async () => {
		const seen = await runWithTenantStorageSettings(null, async () => RequestContext.currentRequest()?.['tenantSettings']);

		expect(seen).toEqual({});
	});
});
