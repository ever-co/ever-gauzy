import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Task } from './../task.entity';

/**
 * A task's move to another status, and nothing else: no title, assignees or other field read
 * earlier rides along to undo a newer edit (the project board saves a card dropped on another
 * column with it).
 *
 * `organizationId` is the caller's context only: it must be one of the caller's organizations, the
 * route checks it is the task's, and it is never written to the task.
 */
export class UpdateTaskStatusDTO extends IntersectionType(
	PickType(TenantOrganizationBaseDTO, ['organizationId'] as const),
	PickType(Task, ['status', 'taskStatusId'] as const)
) {}
