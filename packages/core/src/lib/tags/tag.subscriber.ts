import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { localFileUrl } from './../core/file-storage/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Tag } from './tag.entity';

@EventSubscriber()
export class TagSubscriber extends BaseEntityEventSubscriber<Tag> {
	/**
	 * Indicates that this subscriber only listen to Tag events.
	 */
	listenTo() {
		return Tag;
	}

	/**
	 * Called after a Tag entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL using the FileStorage provider.
	 *
	 * @param entity The Tag entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: Tag): Promise<void> {
		try {
			// Update the fullIconUrl if an icon is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error(
				`TagSubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Called before a Tag entity is inserted into the database. This method sets a default color
	 * for the tag if one isn't provided.
	 *
	 * @param entity The Tag entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: Tag): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color ??= faker.color.rgb();
		} catch (error) {
			console.error('TagSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Sets the full icon URL, as served by the LOCAL file storage provider.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: Tag): Promise<void> {
		try {
			entity.fullIconUrl = await localFileUrl(entity.icon);
		} catch (error) {
			console.error('TagSubscriber: Error during the setFullIconUrl process:', error);
			throw error;
		}
	}
}
