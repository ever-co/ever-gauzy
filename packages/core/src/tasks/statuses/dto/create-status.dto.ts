import { ITaskStatusCreateInput, TaskStatusEnum } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { TaskStatus } from '../status.entity';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { IsEnum, IsOptional } from 'class-validator';

export class CreateStatusDTO
	extends IntersectionType(PartialType(TenantOrganizationBaseDTO), TaskStatus)
	implements ITaskStatusCreateInput
{
	@ApiPropertyOptional({ type: () => String, enum: TaskStatusEnum })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	template: TaskStatusEnum;
}
