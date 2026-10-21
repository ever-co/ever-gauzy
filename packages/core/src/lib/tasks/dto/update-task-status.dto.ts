import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Task } from './../task.entity';

/**
 * A task's move to another status, and nothing else: no title, assignees or other field read
 * earlier rides along to undo a newer edit (the project board saves a card dropped on another
 * column with it).
 */
export class UpdateTaskStatusDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Task, ['status', 'taskStatusId'] as const)
) {}
