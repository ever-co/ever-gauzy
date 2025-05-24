import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { BaseQueryDTO } from '../../core/crud';
import { TaskAdvancedFilterDTO } from './task-advanced-filter.dto';
import { Task } from '../task.entity';

export class TaskQueryDTO extends BaseQueryDTO<Task> {
	/**
	 * Advanced filters for retrieving tasks.
	 */
	@ApiPropertyOptional({ type: TaskAdvancedFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => TaskAdvancedFilterDTO)
	filters?: TaskAdvancedFilterDTO;
}
