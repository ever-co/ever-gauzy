import { EventSubscriber } from 'typeorm';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Integration } from './integration.entity';

@EventSubscriber()
export class IntegrationSubscriber extends BaseEntityEventSubscriber<Integration> {
	/**
	 * Indicates that this subscriber only listen to Integration events.
	 */
	listenTo() {
		return Integration;
	}

	/**
	 * Called after an Integration entity is loaded from the database. This method updates
	 * the entity by setting the full image URL using a specified file storage provider.
	 *
	 * @param entity The Integration entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: Integration): Promise<void> {
		try {
			// Check if imgSrc is present and non-empty
			if (entity.imgSrc) {
				// Instantiate FileStorage with the desired provider
				const provider = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);

				// Retrieve and set the full image URL
				entity.fullImgUrl = await provider.getProviderInstance().url(entity.imgSrc);
			}
		} catch (error) {
			console.error('IntegrationSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}
}
