import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { Timesheet } from './timesheet.entity';

@EventSubscriber()
export class TimesheetSubscriber extends BaseEntityEventSubscriber<Timesheet> {
	/**
	 * Indicates that this subscriber only listen to Timesheet events.
	 */
	listenTo() {
		return Timesheet;
	}

	/**
	 * Called after an Timesheet entity is loaded from the database.
	 *
	 * @param entity - The loaded Timesheet entity.
	 * @param event - The LoadEvent associated with the entity loading.
	 */
	async afterEntityLoad(entity: Timesheet): Promise<void> {
		/**
		 * Sets the 'isEdited' property based on the presence of 'editedAt'.
		 * If 'editedAt' is defined, 'isEdited' is set to true; otherwise, it is set to false.
		 */
		if (Object.prototype.hasOwnProperty.call(entity, 'editedAt')) {
			entity.isEdited = !!entity.editedAt;
		}
	}
}
