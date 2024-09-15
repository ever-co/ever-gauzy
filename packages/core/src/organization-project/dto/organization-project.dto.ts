import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { OrganizationProject } from './../organization-project.entity';
import { UpdateTaskModeDTO } from './update-task-mode.dto';

export class OrganizationProjectDTO extends IntersectionType(
	PickType(OrganizationProject, ['imageId', 'name', 'billing', 'budgetType'] as const),
	PartialType(UpdateTaskModeDTO)
) {}
