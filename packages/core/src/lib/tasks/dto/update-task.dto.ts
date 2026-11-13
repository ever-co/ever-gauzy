import { ITaskUpdateInput } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaskDTO } from './create-task.dto';

/**
 * Update task validation request DTO
 */
export class UpdateTaskDTO extends CreateTaskDTO implements ITaskUpdateInput {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly moveTimeLogs?: boolean;
}
