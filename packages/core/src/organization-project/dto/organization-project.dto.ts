import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrganizationProject } from './../organization-project.entity';
import { UpdateTaskModeDTO } from './update-task-mode.dto';

/**
 * Organization Project DTO request validation
 */
export class OrganizationProjectDTO extends IntersectionType(
	PickType(OrganizationProject, ['imageId', 'name', 'billing', 'budgetType'] as const),
	PartialType(UpdateTaskModeDTO)
) {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	memberIds?: ID[] = [];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	managerIds?: ID[] = [];
}
