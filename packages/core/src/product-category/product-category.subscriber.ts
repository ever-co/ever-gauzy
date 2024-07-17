import { EventSubscriber } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

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
			if ('image' in entity) {
				console.log('ProductCategory: Setting imageUrl for product category ID ' + entity.id);
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
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: ProductCategory): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.imageUrl = entity.image?.fullUrl ?? entity.imageUrl;
					resolve();
				});
			} catch (error) {
				console.error('ProductCategorySubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
