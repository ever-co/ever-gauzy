import { EventSubscriber } from 'typeorm';
import { FileStorage } from './../core/file-storage/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { ImageAsset } from './image-asset.entity';
import { publishImageAssetUrls } from './image-asset-urls';

@EventSubscriber()
export class ImageAssetSubscriber extends BaseEntityEventSubscriber<ImageAsset> {
	/**
	 * Indicates that this subscriber only listen to ImageAsset events.
	 */
	listenTo() {
		return ImageAsset;
	}

	/**
	 * Called after an ImageAsset entity is loaded from the database.
	 * This method updates the entity by setting the full and thumbnail URLs using the provided storage provider.
	 *
	 * The resolution is published on the asset (see `publishImageAssetUrls`) before it is awaited, so the load
	 * hook of the entity that carries this image (user, organization, tenant...) can await exactly it to copy
	 * `fullUrl`, rather than waiting a timer hop.
	 *
	 * @param entity The ImageAsset entity that has been loaded.
	 * @returns A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: ImageAsset): Promise<void> {
		try {
			if (entity instanceof ImageAsset) {
				const { storageProvider, url, thumb } = entity;
				const ready = (async () => {
					const store = new FileStorage().setProvider(storageProvider).getProviderInstance();

					// Retrieve full and thumbnail URLs concurrently
					const [fullUrl, thumbUrl] = await Promise.all([store.url(url), store.url(thumb)]);
					entity.fullUrl = fullUrl;
					entity.thumbUrl = thumbUrl;
				})();

				// Owners await this to copy `fullUrl`; a failure is reported below, not to them.
				publishImageAssetUrls(
					entity,
					ready.catch(() => undefined)
				);
				await ready;
			}
		} catch (error) {
			console.error('ImageAssetSubscriber: Error during the afterEntityLoad process:', error);
		}
	}
}
