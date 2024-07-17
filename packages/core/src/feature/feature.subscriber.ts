import { EventSubscriber } from 'typeorm';
import { shuffle } from 'underscore';
import { gauzyToggleFeatures } from '@gauzy/config';
import { FeatureStatusEnum, FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Feature } from './feature.entity';

@EventSubscriber()
export class FeatureSubscriber extends BaseEntityEventSubscriber<Feature> {
	/**
	 * Indicates that this subscriber only listen to Feature events.
	 */
	listenTo() {
		return Feature;
	}

	/**
	 * Called after an entity is loaded from the database.
	 *
	 * @param entity - The loaded Feature entity.
	 */
	async afterEntityLoad(entity: Feature): Promise<void> {
		try {
			// Set a default status if not present
			entity.status = entity.status ?? shuffle(Object.values(FeatureStatusEnum))[0];

			// Check and set isEnabled based on gauzyToggleFeatures
			entity.isEnabled = gauzyToggleFeatures[entity.code] ?? true;

			// Set imageUrl based on the entity's image property
			if ('image' in entity) {
				console.log('Feature: Setting imageUrl for feature ID ' + entity.id);
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error('FeatureSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: Feature): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.imageUrl = await store.getProviderInstance().url(entity.image);
					resolve();
				});
			} catch (error) {
				console.error('FeatureSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
