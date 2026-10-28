import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID, ITaskAdvancedFilter, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';

export class TaskAdvancedFilterDTO implements ITaskAdvancedFilter {
	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	ids?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	projects?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	teams?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	modules?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	sprints?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	members?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	tags?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	statusIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	priorityIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	sizeIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	parentIds?: ID[] = [];

	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsUUID('all', { each: true })
	createdByUserIds?: ID[] = [];

	@ApiPropertyOptional({ enum: TaskStatusEnum, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsEnum(TaskStatusEnum, { each: true })
	statuses?: TaskStatusEnum[] = [];

	@ApiPropertyOptional({ enum: TaskPriorityEnum, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(25)
	@IsEnum(TaskPriorityEnum, { each: true })
	priorities?: TaskPriorityEnum[] = [];

	@ApiPropertyOptional({ type: () => Date, description: 'Due on or after this instant.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	dueDateFrom?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'Due on or before this instant.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	dueDateTo?: Date;

	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'Only tasks without a due date; takes precedence over dueDateFrom and dueDateTo.'
	})
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value === 'true' ? true : value === 'false' ? false : value))
	@IsBoolean()
	withoutDueDate?: boolean;
}
