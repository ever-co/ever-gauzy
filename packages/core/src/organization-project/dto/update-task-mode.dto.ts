import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { IOrganizationProjectsUpdateInput, TaskListTypeEnum } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Update task list view mode DTO validation
 */
export class UpdateTaskModeDTO extends TenantOrganizationBaseDTO implements IOrganizationProjectsUpdateInput {

    @ApiProperty({ enum: TaskListTypeEnum, example: TaskListTypeEnum.GRID })
	@IsEnum(TaskListTypeEnum)
	readonly taskListType: TaskListTypeEnum;
}