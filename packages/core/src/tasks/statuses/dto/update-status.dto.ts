import { ITaskStatusUpdateInput, TaskStatusEnum } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TaskStatus } from '../status.entity';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdatesStatusDTO
	extends IntersectionType(PartialType(TenantOrganizationBaseDTO), PartialType(TaskStatus))
	implements ITaskStatusUpdateInput
{
	@ApiPropertyOptional({ type: () => String, enum: TaskStatusEnum })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	template?: TaskStatusEnum;
}
