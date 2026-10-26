import { EventSubscriber } from 'typeorm';
import { shuffle } from 'underscore';
import { FeatureStatusEnum } from '@gauzy/contracts';
import { localFileUrl } from './../core/file-storage/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { isFeatureEnabledByDefault } from './feature-default-state';
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
			entity.isEnabled = isFeatureEnabledByDefault(entity.code);

			// Set imageUrl based on the entity's image property
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error('FeatureSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Sets the full image URL, as served by the LOCAL file storage provider.
	 *
	 * @param entity
	 * @returns
	 */
	private async setImageUrl(entity: Feature): Promise<void> {
		try {
			entity.imageUrl = await localFileUrl(entity.image);
		} catch (error) {
			console.error('FeatureSubscriber: Error during the setImageUrl process:', error);
			throw error;
		}
	}
}
