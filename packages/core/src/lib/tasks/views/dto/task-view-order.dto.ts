import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ID, ITaskViewOrderInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/** The most tasks a manual order holds. */
export const TASK_VIEW_ORDER_MAX = 5000;

/** `PUT /task-views/:id/order`: the tasks in the order the view shows them. */
export class TaskViewOrderDTO extends TenantOrganizationBaseDTO implements ITaskViewOrderInput {
	@ApiProperty({ type: () => Array, description: 'Task ids in display order' })
	@IsArray()
	@ArrayMaxSize(TASK_VIEW_ORDER_MAX)
	@ArrayUnique()
	@IsUUID('all', { each: true })
	readonly taskIds: ID[];

	@ApiPropertyOptional({ type: () => Number, description: 'The version the client read; refused when stale' })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly expectedVersion?: number;
}
