import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { IOrganizationProjectUpdateInput, TaskListTypeEnum } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Update task list view mode DTO validation
 */
export class UpdateTaskModeDTO extends TenantOrganizationBaseDTO implements IOrganizationProjectUpdateInput {

	@ApiProperty({ enum: TaskListTypeEnum, example: TaskListTypeEnum.GRID })
	@IsEnum(TaskListTypeEnum)
	readonly taskListType: TaskListTypeEnum;
}
