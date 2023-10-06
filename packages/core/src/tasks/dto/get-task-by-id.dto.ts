import { IGetTaskById } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { OptionParams, Task } from 'core';

/**
 * GET task by Id DTO validation
 */
export class GetTaskByIdDTO extends OptionParams<Task> implements IGetTaskById {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	includeRootEpic?: boolean;
}
