import { ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Task } from '../../core/entities/internal';
import { BaseEntityEvent, BaseEntityEventType } from '../base-entity-event';

type TaskInputTypes = ITaskCreateInput | ITaskUpdateInput;

/**
 * Event class representing an task events.
 */
export class TaskEvent extends BaseEntityEvent<Task, TaskInputTypes> {
	/**
	 * Creates an instance of TaskEvent.
	 *
	 * @param {RequestContext} ctx - The context object containing information about the request.
	 * @param {Task} entity - The task entity associated with the event.
	 * @param {BaseEntityEventType} type - The type of the event.
	 * @param {TaskInputTypes} [input] - Optional input data for the event.
	 */
	constructor(ctx: RequestContext, entity: Task, type: BaseEntityEventType, input?: TaskInputTypes) {
		super(entity, type, ctx, input);
	}
}
