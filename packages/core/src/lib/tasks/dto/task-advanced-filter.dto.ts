import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, ITaskAdvancedFilter } from '@gauzy/contracts';

export class TaskAdvancedFilterDTO implements ITaskAdvancedFilter {
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
}
