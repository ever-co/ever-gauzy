import { ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Task } from '../../core/entities/internal';
import { BaseEntityEvent, BaseEntityEventType } from '../base-entity-event';

type TaskInputTypes = ITaskCreateInput | ITaskUpdateInput;

/**
 * Event class representing an integration delete event.
 */
export class TaskEvent extends BaseEntityEvent<Task, TaskInputTypes> {
	constructor(ctx: RequestContext, entity: Task, type: BaseEntityEventType, input?: TaskInputTypes) {
		super(entity, type, ctx, input);
	}
}
