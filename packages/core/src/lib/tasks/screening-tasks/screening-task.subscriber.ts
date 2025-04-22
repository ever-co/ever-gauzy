import { EventSubscriber } from 'typeorm';
import { ScreeningTask } from './screening-task.entity';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class ScreeningTaskSubscriber extends BaseEntityEventSubscriber<ScreeningTask> {
	/**
	 * Indicates that this subscriber only listen to Task events.
	 */
	listenTo() {
		return ScreeningTask;
	}
}
