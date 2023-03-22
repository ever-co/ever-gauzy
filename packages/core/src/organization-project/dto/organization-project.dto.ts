import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { OrganizationProjectBudgetTypeEnum, ProjectBillingEnum } from '@gauzy/contracts';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { OrganizationProject } from './../organization-project.entity';
import { UpdateTaskModeDTO } from './update-task-mode.dto';

export class OrganizationProjectDTO extends IntersectionType(
	PickType(OrganizationProject, ['imageId']),
	PartialType(UpdateTaskModeDTO)
) {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	readonly name: string;

	@ApiPropertyOptional({
		enum: ProjectBillingEnum,
		example: ProjectBillingEnum.FLAT_FEE
	})
	@IsOptional()
	@IsEnum(ProjectBillingEnum)
	readonly billing: ProjectBillingEnum;

	@ApiPropertyOptional({
		enum: OrganizationProjectBudgetTypeEnum,
		example: OrganizationProjectBudgetTypeEnum.COST
	})
	@IsOptional()
	@IsEnum(OrganizationProjectBudgetTypeEnum)
	readonly budgetType: OrganizationProjectBudgetTypeEnum;
}
