/**
 * Importing the file storage reaches `core/entities/internal` and the decorator graph. Loading that graph FIRST
 * matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import {
	IconImageAsset,
	iconFileUrl,
	imageAssetIconUrl,
	imageAssetIconValue,
	isImageAssetIcon,
	parseImageAssetIcon,
	toStoredImageAssetIcon
} from './image-asset-icon';

/**
 * ever-co/ever-teams#5024: a task status, priority, size, version, issue type or related issue type can show an image
 * the user uploaded. The row keeps it in its `icon` column as `image-asset:<id>:<provider>:<key>`, completed from the
 * image asset when it is written, and `fullIconUrl` comes from the provider that holds the file. The icon was always
 * resolved with the LOCAL provider, a wrong URL for an image held by S3, Wasabi, DigitalOcean or Cloudinary.
 */
describe('image asset icons', () => {
	const tenantId = randomUUID();
	const otherTenantId = randomUUID();
	const assetId = randomUUID();
	const key = `uploads/task_property_icons/${tenantId}/image-assets-1731340000-${randomUUID()}.png`;
	const asset: IconImageAsset = { id: assetId, url: key, storageProvider: FileStorageProviderEnum.S3 };
	const stored = `image-asset:${assetId}:S3:${key}`;

	/** The image assets of a tenant, as the service reads them. */
	const assetsOf = (owner: string, ...assets: IconImageAsset[]) =>
		jest.fn(async (id: string, tenant: string) =>
			tenant === owner ? assets.find((candidate) => candidate.id === id) : undefined
		);

	describe('reading a value', () => {
		it('reads the image a client names, and the file a row stores', () => {
			expect(parseImageAssetIcon(`image-asset:${assetId}`)).toEqual({
				id: assetId,
				storageProvider: null,
				key: null
			});
			expect(parseImageAssetIcon(` ${stored} `)).toEqual({
				id: assetId,
				storageProvider: FileStorageProviderEnum.S3,
				key
			});
			expect(parseImageAssetIcon(`image-asset:${assetId}:CLOUDINARY:icons/a:b.png`)).toEqual({
				id: assetId,
				storageProvider: FileStorageProviderEnum.CLOUDINARY,
				key: 'icons/a:b.png'
			});
		});

		it('reads nothing from other icons, an id that is no UUID or a provider Gauzy does not have', () => {
			expect(isImageAssetIcon('hugeicons:done')).toBe(false);
			expect(parseImageAssetIcon('ever-icons/task-statuses/open.svg')).toBeNull();
			expect(parseImageAssetIcon('image-asset:not-an-id')).toBeNull();
			expect(parseImageAssetIcon(`image-asset:${assetId}:FTP:${key}`)).toBeNull();
			expect(parseImageAssetIcon(`image-asset:${assetId}:S3:`)).toBeNull();
			expect(parseImageAssetIcon(null)).toBeNull();
		});

		it('writes the value a row stores for an image asset', () => {
			expect(imageAssetIconValue({ id: assetId, storageProvider: 'S3', url: key })).toBe(stored);
		});
	});

	describe('storing an uploaded icon', () => {
		it('completes the image a client names from its image asset', async () => {
			const findAsset = assetsOf(tenantId, asset);

			await expect(toStoredImageAssetIcon(`image-asset:${assetId}`, { tenantId, findAsset })).resolves.toBe(
				stored
			);
			expect(findAsset).toHaveBeenCalledWith(assetId, tenantId);
		});

		it('takes the provider and the key from the image asset, never from the value sent', async () => {
			const forged = `image-asset:${assetId}:LOCAL:uploads/task_property_icons/${tenantId}/secret.png`;

			await expect(
				toStoredImageAssetIcon(forged, { tenantId, findAsset: assetsOf(tenantId, asset) })
			).resolves.toBe(stored);
		});

		it('stores the key of a file the local provider saved on Windows with forward slashes', async () => {
			const windowsAsset = { ...asset, url: key.split('/').join('\\'), storageProvider: 'LOCAL' };

			await expect(
				toStoredImageAssetIcon(`image-asset:${assetId}`, {
					tenantId,
					findAsset: assetsOf(tenantId, windowsAsset)
				})
			).resolves.toBe(`image-asset:${assetId}:LOCAL:${key}`);
		});

		it('refuses an image asset of another tenant', async () => {
			const findAsset = assetsOf(otherTenantId, asset);

			await expect(toStoredImageAssetIcon(`image-asset:${assetId}`, { tenantId, findAsset })).rejects.toThrow(
				BadRequestException
			);
		});

		it('refuses a value that names no image asset, and an icon set outside a tenant', async () => {
			const findAsset = assetsOf(tenantId, asset);

			await expect(toStoredImageAssetIcon('image-asset:rocket', { tenantId, findAsset })).rejects.toThrow(
				BadRequestException
			);
			await expect(
				toStoredImageAssetIcon(`image-asset:${assetId}`, { tenantId: null, findAsset })
			).rejects.toThrow(BadRequestException);
			expect(findAsset).not.toHaveBeenCalled();
		});

		// The image upload names a Cloudinary file by a public id with no extension: the format is kept apart
		it('stores an image Cloudinary holds under a public id with no extension', async () => {
			const publicId = `uploads/task_property_icons/${tenantId}/file-1731340000-${randomUUID()}`;
			const cloudinaryAsset = { id: assetId, url: publicId, storageProvider: FileStorageProviderEnum.CLOUDINARY };

			await expect(
				toStoredImageAssetIcon(`image-asset:${assetId}`, {
					tenantId,
					findAsset: assetsOf(tenantId, cloudinaryAsset)
				})
			).resolves.toBe(`image-asset:${assetId}:CLOUDINARY:${publicId}`);
		});

		it.each([
			['a file that is not a raster image', { url: key.replace(/\.png$/, '.svg') }],
			[
				'a Cloudinary file that is not a raster image',
				{ url: key.replace(/\.png$/, '.svg'), storageProvider: 'CLOUDINARY' }
			],
			['a file with no extension, outside Cloudinary', { url: key.replace(/\.png$/, '') }],
			['a file whose folder has a dot but whose name has none', { url: `uploads/v1.png/${tenantId}/image` }],
			[
				'a file that names the tenant but resolves into another folder',
				{ url: `uploads/icons/${otherTenantId}/../${tenantId}/a.png` }
			],
			['a file with an encoded dot segment', { url: `uploads/icons/${otherTenantId}/%2e%2e/${tenantId}/a.png` }],
			['a file below the tenant folder rather than in it', { url: `uploads/${tenantId}/icons/a.png` }],
			[
				'a key whose URL would end at a query',
				{ url: `uploads/icons/${otherTenantId}/a.png?x=/${tenantId}/a.png` }
			],
			['a file outside the tenant upload folders', { url: `uploads/task_property_icons/${otherTenantId}/a.png` }],
			['a file of an unknown provider', { storageProvider: null }],
			['a file name too long for the icon column', { url: `uploads/icons/${tenantId}/${'a'.repeat(200)}.png` }]
		])('refuses an image asset of %s', async (_case, change) => {
			const findAsset = assetsOf(tenantId, { ...asset, ...change });

			await expect(toStoredImageAssetIcon(`image-asset:${assetId}`, { tenantId, findAsset })).rejects.toThrow(
				BadRequestException
			);
		});

		it('keeps the icon a row stores when its image asset is gone, and refuses any other missing one', async () => {
			const findAsset = assetsOf(tenantId);
			const storedIcon = jest.fn().mockResolvedValue(stored);

			await expect(toStoredImageAssetIcon(stored, { tenantId, findAsset, storedIcon })).resolves.toBe(stored);
			await expect(
				toStoredImageAssetIcon(`image-asset:${randomUUID()}`, { tenantId, findAsset, storedIcon })
			).rejects.toThrow(BadRequestException);
			await expect(toStoredImageAssetIcon(stored, { tenantId, findAsset })).rejects.toThrow(BadRequestException);
		});
	});

	describe('building the URL of a stored icon', () => {
		const signed = 'https://bucket.s3.amazonaws.com/signed';

		it('asks the provider that holds the file', async () => {
			const url = jest.fn().mockResolvedValue(signed);
			const provider = jest.fn().mockReturnValue({ url });

			await expect(imageAssetIconUrl(stored, tenantId, provider)).resolves.toBe(signed);
			expect(provider).toHaveBeenCalledWith(FileStorageProviderEnum.S3);
			expect(url).toHaveBeenCalledWith(key);
		});

		it('builds no URL for an icon that is not completed, or a file of another tenant', async () => {
			const provider = jest.fn().mockReturnValue({ url: jest.fn().mockResolvedValue(signed) });

			await expect(imageAssetIconUrl(`image-asset:${assetId}`, tenantId, provider)).resolves.toBeNull();
			await expect(imageAssetIconUrl(stored, otherTenantId, provider)).resolves.toBeNull();
			await expect(imageAssetIconUrl(stored, undefined, provider)).resolves.toBeNull();
			expect(provider).not.toHaveBeenCalled();
		});

		// A value written past the services: its key names the tenant, but resolves into another tenant's folder
		it.each([
			`uploads/icons/${tenantId}/../${otherTenantId}/a.png`,
			`uploads/icons/${otherTenantId}/../${tenantId}/a.png`,
			`uploads/icons/${otherTenantId}/%2e%2e/${tenantId}/a.png`,
			`uploads/${tenantId}/icons/a.png`,
			`uploads/icons/${otherTenantId}/a.png?x=/${tenantId}/a.png`,
			`uploads/icons/${otherTenantId}/a.png#/${tenantId}/a.png`,
			`uploads/icons/${otherTenantId}/a.png%3Fx=/${tenantId}/a.png`,
			// A separator encoded inside one segment, or a backslash a browser reads as `/`
			`uploads/icons/${tenantId}/a.png%2F..%2F..%2F${otherTenantId}%2Fx.png`,
			`uploads/icons/${tenantId}/a.png%5C..%5C..%5C${otherTenantId}%5Cx.png`,
			`uploads/icons/${tenantId}/..\\${otherTenantId}\\x.png`
		])('builds no URL for the key %s', async (traversing) => {
			const provider = jest.fn().mockReturnValue({ url: jest.fn().mockResolvedValue(signed) });

			await expect(
				imageAssetIconUrl(`image-asset:${assetId}:LOCAL:${traversing}`, tenantId, provider)
			).resolves.toBeNull();
			expect(provider).not.toHaveBeenCalled();
		});

		it('builds no URL when the provider cannot', async () => {
			const failing = jest.fn().mockReturnValue({ url: jest.fn().mockRejectedValue(new Error('no bucket')) });
			const missing = jest.fn().mockReturnValue(null);
			jest.spyOn(console, 'error').mockImplementation(() => undefined);

			await expect(imageAssetIconUrl(stored, tenantId, failing)).resolves.toBeNull();
			await expect(imageAssetIconUrl(stored, tenantId, missing)).resolves.toBeNull();
		});

		it('serves a file of the local provider from the public folder', async () => {
			const local = `image-asset:${assetId}:LOCAL:${key}`;

			const url = await iconFileUrl(local, tenantId);

			expect(new URL(url as string).pathname).toBe(`/public/${key}`);
		});

		it('resolves every other icon as before', async () => {
			const classic = await iconFileUrl('ever-icons/task-statuses/open.svg', tenantId);

			expect(new URL(classic as string).pathname).toBe('/public/ever-icons/task-statuses/open.svg');
			await expect(iconFileUrl('https://cdn.example.com/rocket.png', tenantId)).resolves.toBe(
				'https://cdn.example.com/rocket.png'
			);
			await expect(iconFileUrl('hugeicons:done', tenantId)).resolves.toBeNull();
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});
});
