import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { FileStorageProviderEnum, ID } from '@gauzy/contracts';
import { FileStorage, localFileUrl } from '../core/file-storage/file-storage';
import { ALLOWED_IMAGE_EXTENSIONS } from '../core/file-storage/helpers/upload-security';
import { Provider } from '../core/file-storage/providers/provider';

/**
 * An icon a user uploaded for a task status, priority, size, version, issue type or related issue type
 * (ever-co/ever-teams#5024). The image is an image asset, uploaded through `POST /image-assets/upload/:folder`, and the
 * row keeps it in its `icon` column, so neither the schema nor the API changes:
 *
 * - a client names the image it uploaded as `image-asset:<image asset id>`;
 * - the row stores `image-asset:<image asset id>:<storage provider>:<file key>`, completed from the image asset when
 *   the row is written ({@link toStoredImageAssetIcon});
 * - `fullIconUrl` is built from that stored value alone, with the provider that holds the file
 *   ({@link imageAssetIconUrl}): listing rows reads no image asset.
 *
 * The icon of a row was always resolved with the LOCAL provider, so an image uploaded to S3, Wasabi, DigitalOcean or
 * Cloudinary got `<API>/public/<key>`, a URL to a file that is not there.
 */
export const IMAGE_ASSET_ICON_SCHEME = 'image-asset:';

/** An uploaded icon, as read from an `icon` value. */
export interface ImageAssetIcon {
	/** The image asset the icon was uploaded as. */
	id: ID;
	/** The provider that holds the file, once the row stores the icon; null in a client's `image-asset:<id>`. */
	storageProvider: FileStorageProviderEnum | null;
	/** The key of the file in that provider, once the row stores the icon. */
	key: string | null;
}

/** The columns of an image asset an icon is completed from. */
export interface IconImageAsset {
	id: ID;
	url: string;
	storageProvider?: string | null;
}

/** Where a stored icon is completed from: the image asset of the caller's tenant, and the row's own icon. */
export interface ImageAssetIconSources {
	tenantId: ID | null | undefined;
	/** The image asset `id` of `tenantId`, or nothing when there is none. */
	findAsset: (id: ID, tenantId: ID) => Promise<IconImageAsset | null | undefined>;
	/** The icon the row stores now, for a row that is updated. */
	storedIcon?: () => Promise<string | null | undefined>;
}

/** The `icon` column is a `varchar(255)` on MySQL. */
const ICON_MAX_LENGTH = 255;

const PROVIDERS: ReadonlySet<string> = new Set(Object.values(FileStorageProviderEnum));
const RASTER_EXTENSIONS: ReadonlySet<string> = new Set(ALLOWED_IMAGE_EXTENSIONS);

/** Whether the value names an uploaded icon, stored or not. */
export function isImageAssetIcon(value: unknown): value is string {
	return typeof value === 'string' && value.trim().startsWith(IMAGE_ASSET_ICON_SCHEME);
}

/**
 * The uploaded icon a value names: `image-asset:<id>` as a client sends it, or `image-asset:<id>:<provider>:<key>` as
 * a row stores it. Null for any other value, an id that is no UUID, or a provider Gauzy does not have.
 */
export function parseImageAssetIcon(value: unknown): ImageAssetIcon | null {
	if (!isImageAssetIcon(value)) {
		return null;
	}
	const [id, storageProvider, ...keyParts] = value.trim().slice(IMAGE_ASSET_ICON_SCHEME.length).split(':');
	if (!isUUID(id)) {
		return null;
	}
	if (storageProvider === undefined) {
		return { id, storageProvider: null, key: null };
	}
	// A key may hold a colon of its own
	const key = keyParts.join(':');
	if (!PROVIDERS.has(storageProvider) || !key) {
		return null;
	}
	return { id, storageProvider: storageProvider as FileStorageProviderEnum, key };
}

/** The icon a row stores for an image asset. */
export function imageAssetIconValue(asset: { id: ID; storageProvider: string; url: string }): string {
	return `${IMAGE_ASSET_ICON_SCHEME}${asset.id}:${asset.storageProvider}:${asset.url}`;
}

/**
 * A segment a URL would not keep as a plain folder or file name: empty, a dot segment, or one holding a query or
 * fragment delimiter (the path of the URL would end there), as is or percent-encoded (`%2e%2e`, `%3F`).
 */
function isUnsafeSegment(segment: string): boolean {
	let decoded: string;
	try {
		decoded = decodeURIComponent(segment);
	} catch {
		// A malformed escape is in no file name the upload gives
		return true;
	}
	// A separator inside a segment (an encoded `/`, or a backslash a browser reads as `/`) could move the file once resolved
	return (
		!decoded ||
		decoded === '.' ||
		decoded === '..' ||
		/[?#\\]/.test(segment) ||
		/[?#/\\]/.test(decoded)
	);
}

/**
 * Every image asset upload is stored in `uploads/<folder>/<tenant id>/`: a key is the tenant's when its file lies
 * directly in that tenant's folder, and no segment of it could move the file elsewhere once resolved as a URL.
 */
function isKeyOfTenant(key: string, tenantId: ID | null | undefined): boolean {
	if (!tenantId) {
		return false;
	}
	const segments = key.split('/');
	if (segments.some(isUnsafeSegment)) {
		return false;
	}
	return segments.length >= 2 && segments[segments.length - 2] === tenantId;
}

/**
 * Whether a key names a raster image file, by its extension. A Cloudinary key is the asset's public id, which the image
 * upload names with no extension (Cloudinary keeps the format apart): one without any is taken for Cloudinary alone. A
 * key whose extension is not a raster image's is refused whatever the provider.
 */
function isRasterKey(key: string, storageProvider: string): boolean {
	const name = key.slice(key.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	if (dot < 0) {
		return storageProvider === FileStorageProviderEnum.CLOUDINARY;
	}
	return RASTER_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/**
 * The value a row stores for an uploaded icon a client sends: `image-asset:<id>` (or a stored value sent back) is
 * completed from the image asset of the caller's tenant. The provider and the key always come from the image asset,
 * never from the value, so a client cannot point an icon at a file of its choosing.
 *
 * An image asset that is gone (a media gallery deletion keeps the file) leaves a row's icon as it is when the value
 * sent is the one the row stores, so renaming the row still works.
 *
 * @throws BadRequestException when the value names no image asset of the tenant, or one that cannot be an icon: a file
 * that is not a raster image, or that lies outside the tenant's upload folders.
 */
export async function toStoredImageAssetIcon(value: string, sources: ImageAssetIconSources): Promise<string> {
	const icon = parseImageAssetIcon(value);
	if (!icon) {
		throw new BadRequestException('An uploaded icon is named `image-asset:<image asset id>`.');
	}
	const { tenantId, findAsset, storedIcon } = sources;
	if (!tenantId) {
		throw new BadRequestException('An uploaded icon can only be set inside a tenant.');
	}

	const asset = await findAsset(icon.id, tenantId);
	if (!asset) {
		const stored = storedIcon ? await storedIcon() : null;
		if (stored && stored.trim() === value.trim()) {
			return stored;
		}
		throw new BadRequestException('The image of the icon was not found.');
	}

	// A key the local provider stored on Windows has backslashes; a URL path has none
	const key = (asset.url ?? '').replace(/\\/g, '/');
	const storageProvider = asset.storageProvider ?? '';
	if (
		!key ||
		!PROVIDERS.has(storageProvider) ||
		!isRasterKey(key, storageProvider) ||
		!isKeyOfTenant(key, tenantId)
	) {
		throw new BadRequestException('This image cannot be used as an icon.');
	}

	const stored = imageAssetIconValue({ id: asset.id, storageProvider, url: key });
	if (stored.length > ICON_MAX_LENGTH) {
		throw new BadRequestException('The file name of this image is too long for an icon.');
	}
	return stored;
}

let storage: FileStorage | undefined;

/** A provider instance, from one `FileStorage` (its providers are singletons) rather than a new one for every row. */
function providerOf(name: FileStorageProviderEnum): Provider<unknown> | null {
	storage ??= new FileStorage();
	return storage.setProvider(name).getProviderInstance();
}

/**
 * The URL of a stored uploaded icon, from the provider that holds its file (a signed URL for the S3 family). Null for
 * an icon that is not completed (`image-asset:<id>`), or whose file lies outside the row's tenant: a value written
 * past {@link toStoredImageAssetIcon}, by an import for instance, never reaches another tenant's file.
 *
 * @param value - The stored `icon`.
 * @param tenantId - The tenant of the row.
 * @param provider - The provider instance of a provider name (a parameter for the tests).
 */
export async function imageAssetIconUrl(
	value: string,
	tenantId: ID | null | undefined,
	provider: (name: FileStorageProviderEnum) => Provider<unknown> | null = providerOf
): Promise<string | null> {
	const icon = parseImageAssetIcon(value);
	if (!icon?.storageProvider || !icon.key || !isKeyOfTenant(icon.key, tenantId)) {
		return null;
	}
	try {
		// Resolved and called in one synchronous step: the S3 family reads the request's tenant settings there
		const store = provider(icon.storageProvider);
		return store ? ((await store.url(icon.key)) ?? null) : null;
	} catch (error) {
		console.error('imageAssetIconUrl: the URL of an uploaded icon could not be built:', error?.message);
		return null;
	}
}

/**
 * The `fullIconUrl` of a task status, priority, size, version, issue type or related issue type: an uploaded icon from
 * the provider that holds it, any other value as the LOCAL provider serves it (see `localFileUrl`).
 *
 * @param icon - The row's `icon`.
 * @param tenantId - The row's tenant.
 */
export function iconFileUrl(icon: string | null | undefined, tenantId: ID | null | undefined): Promise<string | null> {
	if (isImageAssetIcon(icon)) {
		return imageAssetIconUrl(icon, tenantId);
	}
	return localFileUrl(icon as string);
}
