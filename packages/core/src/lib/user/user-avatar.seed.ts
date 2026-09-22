import { DataSource } from 'typeorm';
import * as path from 'path';
import { environment as env, getConfig } from '@gauzy/config';
import { ApplicationPluginConfig } from '@gauzy/common';
import { FileStorageProviderEnum, ITenant } from '@gauzy/contracts';
import { ImageAsset } from './../core/entities/internal';
import { FileStorage } from './../core/file-storage';
import { copyAssets, getImageDimensions } from './../core/seeds/utils';
import { getSeedAvatarFileName, SEED_AVATARS_DIR } from './user-avatar';

/** A seeded avatar that was copied into the API public assets and stored as an ImageAsset. */
export interface ISeededUserAvatar {
	/** The persisted asset, to be attached to `User.image`. */
	image: ImageAsset;
	/** The resolved absolute URL, to be stored on `User.imageUrl`. */
	url: string;
}

/**
 * Turns a seeded `imageUrl` (`assets/images/avatars/<file>`) into a real ImageAsset.
 *
 * The avatars that ship with the seed used to be written into `User.imageUrl` verbatim. That value
 * only resolves inside the Angular Gauzy app, which serves those files itself under `<base href="/">`;
 * for Ever Teams (Next.js) and every other client it resolved against the current route and 404'd.
 * Copying the file into the API's public assets and storing an ImageAsset puts seeded avatars through
 * exactly the same path as an avatar a user uploads, so every client gets a resolvable absolute URL.
 *
 * Mirrors `createDefaultIssueTypes`, which already does this for task icons in the same seed run.
 * Any failure returns `undefined` so the caller can fall back rather than abort seeding.
 */
export const createSeededUserAvatar = async (
	dataSource: DataSource,
	imageUrl: string | null | undefined,
	tenant?: ITenant,
	config: Partial<ApplicationPluginConfig> = getConfig()
): Promise<ISeededUserAvatar | undefined> => {
	const fileName = getSeedAvatarFileName(imageUrl);
	if (!fileName) return undefined;

	try {
		// Copy the avatar out of the seed directory into the API's public assets.
		const storagePath = copyAssets(fileName, config, SEED_AVATARS_DIR);
		if (!storagePath) return undefined;

		// Resolve where that public directory actually is, the same way the issue-type seed does.
		const isDist = __dirname.includes('dist');
		const publicDir = isDist
			? path.resolve(process.cwd(), 'apps/api/public')
			: path.resolve(__dirname, '../../../apps/api/public');
		const assetPublicPath = env.isElectron
			? path.resolve(env.gauzyUserPath, 'public')
			: config.assetOptions?.assetPublicPath || publicDir;

		const { height, width, size } = await getImageDimensions(path.join(assetPublicPath, storagePath));

		// `copyAssets` returns a `path.join` result, so on Windows it is backslash-separated. A storage
		// key is part of a URL and must always use forward slashes.
		const storageKey = storagePath.split(path.sep).join('/');

		// Resolve the absolute URL BEFORE persisting anything, so a failure here cannot leave an
		// ImageAsset row behind that nothing references. The URL is also stored on `imageUrl` so the
		// column is usable on its own, without a reader having to load the `image` relation.
		const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL).getProviderInstance();
		const url = await store.url(storageKey);
		if (!url) return undefined;

		const asset = new ImageAsset();
		asset.name = fileName;
		asset.url = storageKey;
		asset.storageProvider = FileStorageProviderEnum.LOCAL;
		asset.height = height;
		asset.width = width;
		asset.size = size;
		if (tenant) asset.tenant = tenant;

		const image = await dataSource.getRepository(ImageAsset).save(asset);

		return { image, url };
	} catch (error) {
		console.error(`Error while seeding avatar "${fileName}":`, error?.message);
		return undefined;
	}
};
