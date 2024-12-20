import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { MemberEntityBasedDTO } from '../../core/dto';
import { OrganizationProject } from './../organization-project.entity';
import { UpdateTaskModeDTO } from './update-task-mode.dto';

/**
 * Organization Project DTO request validation
 */
export class OrganizationProjectDTO extends IntersectionType(
	PickType(OrganizationProject, ['imageId', 'name', 'billing', 'budgetType'] as const),
	IntersectionType(PartialType(UpdateTaskModeDTO), MemberEntityBasedDTO)
) {}
