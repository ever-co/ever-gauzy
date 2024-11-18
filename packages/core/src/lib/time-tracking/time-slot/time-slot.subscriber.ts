import { EventSubscriber } from 'typeorm';
import moment from 'moment';
import { IScreenshot, ITimeSlot } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TimeSlot } from './time-slot.entity';
import { FileStorage } from './../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class TimeSlotSubscriber extends BaseEntityEventSubscriber<TimeSlot> {
	/**
	 * Indicates that this subscriber only listen to TimeSlot events.
	 */
	listenTo() {
		return TimeSlot;
	}

	/**
	 * Called after a TimeSlot entity is loaded from the database. This method updates
	 * the entity with additional calculated properties.
	 *
	 * @param entity The TimeSlot entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: TimeSlot): Promise<void> {
		try {
			// Update 'stoppedAt' time based on 'startedAt'
			if (Object.prototype.hasOwnProperty.call(entity, 'startedAt')) {
				entity.stoppedAt = moment(entity.startedAt).add(10, 'minutes').toDate();
			}
			// Calculate activity percentages
			if (Object.prototype.hasOwnProperty.call(entity, 'overall')) {
				entity.percentage = this.calculateOverallActivity(entity);
			}
			if (Object.prototype.hasOwnProperty.call(entity, 'keyboard')) {
				entity.keyboardPercentage = this.calculateKeyboardActivity(entity);
			}
			if (Object.prototype.hasOwnProperty.call(entity, 'mouse')) {
				entity.mousePercentage = this.calculateMouseActivity(entity);
			}
		} catch (error) {
			console.error('TimeSlotSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called after a TimeSlot entity is removed from the database. This method handles the
	 * deletion of associated screenshot files from the storage.
	 *
	 * @param entity The TimeSlot entity that was just deleted.
	 * @returns {Promise<void>} A promise that resolves when the file deletion operations are complete.
	 */
	async afterEntityDelete(entity: TimeSlot): Promise<void> {
		try {
			const { screenshots } = entity ?? {};
			const entityId = entity?.id;

			if (entityId && Array.isArray(screenshots) && isNotEmpty(screenshots)) {
				console.log(`AFTER TIME_SLOT WITH ID ${entityId} REMOVED`);

				// Create FileStorage instance outside the loop if possible
				const storage = new FileStorage();

				// Prepare all deletion promises
				const promises = screenshots.flatMap((screenshot: IScreenshot) => {
					if (!screenshot) return [];

					// Get the provider instance for the screenshot's storage provider
					const instance = storage.getProvider(screenshot?.storageProvider).getProviderInstance();

					// Get the paths for the screenshot's file and thumbnail
					const paths = [screenshot?.file, screenshot?.thumb].filter(Boolean);
					console.log('screenshot delete paths', paths);

					// Create deletion promises for each file
					return paths.map((filePath) => instance.deleteFile(filePath)); // Create deletion promise for each file
				});

				// Execute all deletion promises in parallel
				await Promise.all(promises);
			}
		} catch (error) {
			console.error('TimeSlotSubscriber: An error occurred during the afterEntityDelete process:', error);
		}
	}

	/**
	 * Calculates the activity percentage based on activity time and total duration.
	 * If the duration is zero, the function returns zero to avoid division by zero errors.
	 *
	 * @param activity The amount of time spent on a specific activity.
	 * @param duration The total duration for which the activity is calculated.
	 * @returns The activity as a percentage of the total duration, rounded to two decimal places.
	 */
	private calculateActivity(activity: number, duration: number): number {
		if (duration === 0) return 0;
		return parseFloat(Math.round((activity * 100) / duration).toFixed(2));
	}

	/**
	 * Calculate overall activity in percentage
	 *
	 * @param entity
	 * @returns
	 */
	private calculateOverallActivity(entity: ITimeSlot): number {
		return this.calculateActivity(entity.overall, entity.duration);
	}

	/**
	 * Calculate mouse activity in percentage
	 *
	 * @param entity
	 * @returns
	 */
	private calculateMouseActivity(entity: ITimeSlot): number {
		return this.calculateActivity(entity.mouse, entity.duration);
	}

	/**
	 * Calculate keyboard activity in percentage
	 *
	 * @param entity
	 * @returns
	 */
	private calculateKeyboardActivity(entity: ITimeSlot): number {
		return this.calculateActivity(entity.keyboard, entity.duration);
	}
}
