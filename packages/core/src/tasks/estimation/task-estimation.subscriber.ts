import {
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	RemoveEvent,
	UpdateEvent,
} from 'typeorm';
import { TaskEstimation } from './task-estimation.entity';
import { TaskService } from '../task.service';
import { TaskEstimationService } from './task-estimation.service';

@EventSubscriber()
export class TaskEstimationSubscriber
	implements EntitySubscriberInterface<TaskEstimation>
{
	constructor(
		private readonly taskService: TaskService,
		private readonly taskEstimationService: TaskEstimationService
	) {}

	/**
	 * Indicates that this subscriber only listen to TaskEstimation events.
	 */
	listenTo() {
		return TaskEstimation;
	}

	/**
	 * Called after entity is inserted to the database.
	 *
	 * @param event
	 */
	async afterInsert(event: InsertEvent<TaskEstimation>) {
		try {
			// TODO
		} catch (error) {
			console.log(
				'Error while creating task estimation : subscriber : ',
				error
			);
		}
	}
	/**
	 * Called after entity is removed
	 *
	 * @param event
	 */
	async afterRemove(event: RemoveEvent<TaskEstimation>) {
		try {
			// TODO
		} catch (error) {
			console.log(
				'Error while creating task estimation : subscriber : ',
				error
			);
		}
	}
	/**
	 * Called after entity is removed
	 *
	 * @param event
	 */
	async afterUpdate(event: UpdateEvent<TaskEstimation>) {
		try {
			// TODO
		} catch (error) {
			console.log(
				'Error while creating task estimation : subscriber : ',
				error
			);
		}
	}
}
