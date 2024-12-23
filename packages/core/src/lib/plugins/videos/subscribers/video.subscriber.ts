import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../../../core/entities/subscribers/base-entity-event.subscriber';
import { FileStorage } from '../../../core/file-storage';
import { Logger } from '@nestjs/common';
import { Video } from '../entities/video.entity';

@EventSubscriber()
export class VideoSubscriber extends BaseEntityEventSubscriber<Video> {
	private readonly logger = new Logger('VideoSubscriber');
	/**
	 * Specifies the entity this subscriber listens to.
	 */
	public listenTo() {
		return Video;
	}

	/**
	 * Called after a video entity is loaded from the database.
	 * This method assigns the full URL of the video file to the entity.
	 *
	 * @param entity The video entity that was loaded.
	 */
	public async afterEntityLoad(entity: Video): Promise<void> {
		if (!(entity instanceof Video)) {
			return; // Exit if the entity is not a Video instance
		}

		try {
			const { storageProvider, file } = entity;
			if (!storageProvider || !file) {
				this.logger.warn('Missing storageProvider or file in the entity');
				return;
			}

			const provider = new FileStorage().setProvider(storageProvider).getProviderInstance();
			entity.fullUrl = await provider.url(file);
		} catch (error) {
			this.logger.error('Error during afterEntityLoad:', error.message);
		}
	}

	/**
	 * Called after a video entity is deleted from the database.
	 * This method deletes the associated file from the storage system.
	 *
	 * @param entity The video entity that was deleted.
	 */
	public async afterEntityDelete(entity: Video): Promise<void> {
		if (!(entity instanceof Video)) {
			return; // Exit if the entity is not a Video instance
		}

		try {
			const { id: entityId, storageProvider, file } = entity;

			if (!storageProvider || !file) {
				this.logger.warn(`Missing storageProvider or file for entity ID ${entityId}`);
				return;
			}

			const provider = new FileStorage().setProvider(storageProvider).getProviderInstance();
			await provider.deleteFile(file);

			this.logger.log(`Successfully deleted file for entity ID ${entityId}`);
		} catch (error) {
			this.logger.error(`Error deleting file for entity ID ${entity.id}:`, error.message);
		}
	}
}
