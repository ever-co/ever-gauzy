import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsEnum } from "class-validator";
import { IUpdateTimesheetStatusInput, TimesheetStatus } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../../../core/dto";

/**
 * Update timesheets status request DTO validation
 */
export class UpdateTimesheetStatusDTO extends TenantOrganizationBaseDTO
	implements IUpdateTimesheetStatusInput {

    @ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
    readonly ids: string[] = [];

	@ApiProperty({ enum: TimesheetStatus })
	@IsEnum(TimesheetStatus)
	readonly status: TimesheetStatus;
}