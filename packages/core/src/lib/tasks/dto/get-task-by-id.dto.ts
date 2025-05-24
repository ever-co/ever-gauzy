import { IGetTaskById } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { FindOptionsQueryDTO } from '../../core/crud';
import { Task } from '../../core/entities/internal';

/**
 * GET task by Id DTO validation
 */
export class GetTaskByIdDTO extends FindOptionsQueryDTO<Task> implements IGetTaskById {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	includeRootEpic?: boolean;
}
