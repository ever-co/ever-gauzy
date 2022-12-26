import { OrganizationProjectBudgetTypeEnum, ProjectBillingEnum, TaskListTypeEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class OrganizationProjectDTO extends TenantOrganizationBaseDTO {

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
		enum: TaskListTypeEnum,
		example: TaskListTypeEnum.GRID
	})
	@IsOptional()
	@IsEnum(TaskListTypeEnum)
	readonly taskListType: TaskListTypeEnum;

    @ApiPropertyOptional({
		enum: OrganizationProjectBudgetTypeEnum,
		example: OrganizationProjectBudgetTypeEnum.COST
	})
	@IsOptional()
	@IsEnum(OrganizationProjectBudgetTypeEnum)
	readonly budgetType: OrganizationProjectBudgetTypeEnum;
}