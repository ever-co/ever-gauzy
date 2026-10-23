import { EventSubscriber } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { imageAssetUrlsReady } from '../image-asset/image-asset-urls';

@EventSubscriber()
export class ProductCategorySubscriber extends BaseEntityEventSubscriber<ProductCategory> {
	/**
	 * Indicates that this subscriber only listen to ProductCategory events.
	 */
	listenTo() {
		return ProductCategory;
	}

	/**
	 * Called after a ProductCategory entity is loaded from the database. This method updates
	 * the entity's imageUrl if an associated image with a full URL is present.
	 *
	 * @param entity The ProductCategory entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: ProductCategory): Promise<void> {
		try {
			// Set imageUrl from the image object's fullUrl, if available. Fall back to existing imageUrl if not.
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error(
				`ProductCategorySubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Sets `imageUrl` from the image's `fullUrl`, falling back to the existing `imageUrl`. Waits only for the
	 * image's own URL resolution, and not at all when there is no image (see `imageAssetUrlsReady`).
	 *
	 * @param entity
	 * @returns
	 */
	private async setImageUrl(entity: ProductCategory): Promise<void> {
		try {
			const ready = imageAssetUrlsReady(entity.image);
			if (ready) {
				await ready;
			}
			entity.imageUrl = entity.image?.fullUrl ?? entity.imageUrl;
		} catch (error) {
			console.error('ProductCategorySubscriber: Error during the setImageUrl process:', error);
			throw error;
		}
	}
}
