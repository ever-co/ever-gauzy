import { EventSubscriber } from 'typeorm';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { Report } from './report.entity';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class ReportSubscriber extends BaseEntityEventSubscriber<Report> {
	/**
	 * Indicates that this subscriber only listen to Report events.
	 */
	listenTo() {
		return Report;
	}

	/**
	 * Called after a Report entity is loaded from the database. This method updates
	 * the entity by setting the image URL using the FileStorage provider.
	 *
	 * @param entity The Report entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: Report): Promise<void> {
		try {
			// Update the imageUrl if an image property is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error(
				`ReportSubscriber: An error occurred during the afterEntityLoad process for report ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the image URL.
	 *
	 * @param entity
	 * @returns
	 */
	private async setImageUrl(entity: Report): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.imageUrl = await store.getProviderInstance().url(entity.image);
					resolve();
				});
			} catch (error) {
				console.error('ReportSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
