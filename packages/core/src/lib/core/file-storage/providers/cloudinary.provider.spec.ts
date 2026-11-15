/**
 * ever-co/ever-gauzy#11890: a tenant can keep its own Cloudinary account in its settings. Its uploads used those
 * settings, but the URL of each image asset, screenshot and uploaded icon came from the deployment's defaults:
 * `FileStorage` hands out the provider's inner instance, built once with the defaults, and its `url()` and `path()`
 * never read the request's tenant settings.
 */
jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');
	return {
		...actual,
		environment: {
			...actual.environment,
			cloudinary: {
				cloud_name: 'deployment-cloud',
				api_key: 'deployment-key',
				api_secret: 'deployment-secret',
				secure: true,
				delivery_url: 'https://cdn.deployment.example.com'
			}
		}
	};
});

/**
 * Importing the file storage reaches `core/entities/internal` and the decorator graph. Loading that graph FIRST
 * matches the application boot order (see employee.entity.spec.ts).
 */
import '../../entities/internal';

import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { RequestContext } from '../../context/request-context';
import { FileStorage } from '../file-storage';
import { runWithTenantStorageSettings } from '../tenant-storage-settings';

/** A tenant with a Cloudinary account of its own. */
const tenantWithAccount = {
	fileStorageProvider: FileStorageProviderEnum.CLOUDINARY,
	cloudinary_cloud_name: 'tenant-cloud',
	cloudinary_api_key: 'tenant-key',
	cloudinary_api_secret: 'tenant-secret',
	cloudinary_delivery_url: 'https://cdn.tenant.example.com'
};

/** A tenant that keeps its files on the deployment's Cloudinary account. */
const tenantWithoutAccount = { fileStorageProvider: FileStorageProviderEnum.CLOUDINARY };

/** The provider every image asset and screenshot URL is built with, as the subscribers get it. */
const cloudinaryProvider = () =>
	new FileStorage().setProvider(FileStorageProviderEnum.CLOUDINARY).getProviderInstance();

describe('CloudinaryProvider: URLs come from the settings of the request tenant (#11890)', () => {
	const originalClsService = RequestContext['clsService'];

	beforeEach(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
	});

	it('builds the URL of a tenant with its own account from its cloud name and delivery URL', async () => {
		const url = await runWithTenantStorageSettings(tenantWithAccount, () =>
			cloudinaryProvider().url('uploads/images/photo.png')
		);

		expect(url).toBe('https://cdn.tenant.example.com/tenant-cloud/uploads/images/photo.png');
	});

	it("gives a tenant without an account the deployment's URL, after another tenant's request", async () => {
		await runWithTenantStorageSettings(tenantWithAccount, () => cloudinaryProvider().url('uploads/a.png'));

		const url = await runWithTenantStorageSettings(tenantWithoutAccount, () =>
			cloudinaryProvider().url('uploads/b.png')
		);

		expect(url).toBe('https://cdn.deployment.example.com/deployment-cloud/uploads/b.png');
	});

	it('keeps the URLs of two tenants apart when their requests run together', async () => {
		const urls = await Promise.all([
			runWithTenantStorageSettings(tenantWithAccount, () => cloudinaryProvider().url('uploads/a.png')),
			runWithTenantStorageSettings(tenantWithoutAccount, () => cloudinaryProvider().url('uploads/b.png'))
		]);

		expect(urls).toEqual([
			'https://cdn.tenant.example.com/tenant-cloud/uploads/a.png',
			'https://cdn.deployment.example.com/deployment-cloud/uploads/b.png'
		]);
	});

	it('builds path() from the same settings', async () => {
		const tenantPath = await runWithTenantStorageSettings(tenantWithAccount, async () =>
			cloudinaryProvider().path('uploads/a.png')
		);
		const defaultPath = await runWithTenantStorageSettings(tenantWithoutAccount, async () =>
			cloudinaryProvider().path('uploads/b.png')
		);

		expect(tenantPath).toBe('https://cdn.tenant.example.com/tenant-cloud/uploads/a.png');
		expect(defaultPath).toBe('https://cdn.deployment.example.com/deployment-cloud/uploads/b.png');
	});

	it('keeps a key that is already a URL as it is', async () => {
		const stored = 'https://res.example.com/other-cloud/uploads/c.png';

		const url = await runWithTenantStorageSettings(tenantWithAccount, () => cloudinaryProvider().url(stored));

		expect(url).toBe(stored);
		expect(cloudinaryProvider().path(stored)).toBe(stored);
	});
});
