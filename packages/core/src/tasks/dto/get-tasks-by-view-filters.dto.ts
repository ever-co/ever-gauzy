import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID, IGetTasksByViewFilters, TaskPriorityEnum, TaskSizeEnum, TaskStatusEnum } from '@gauzy/contracts';

/**
 * Get Tasks by Task View Query Options
 */
export class GetTasksByViewFiltersDTO implements IGetTasksByViewFilters {
	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	projects?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	teams?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	modules?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	sprints?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	members?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	tags?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	statusIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array, enum: TaskStatusEnum })
	@IsOptional()
	@IsArray()
	@IsEnum(TaskStatusEnum, { each: true })
	statuses?: TaskStatusEnum[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	priorityIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array, enum: TaskPriorityEnum })
	@IsOptional()
	@IsArray()
	@IsEnum(TaskPriorityEnum, { each: true })
	priorities?: TaskPriorityEnum[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	sizeIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array, enum: TaskSizeEnum })
	@IsOptional()
	@IsArray()
	@IsEnum(TaskSizeEnum, { each: true })
	sizes?: TaskSizeEnum[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	types?: string[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	startDates?: Date[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	dueDates?: Date[];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	creators?: ID[] = [];

	// Defined Relations
	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	relations?: any[];
}
