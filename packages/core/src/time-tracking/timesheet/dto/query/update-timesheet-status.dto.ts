import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsEnum } from "class-validator";
import { IUpdateTimesheetStatusInput, TimesheetStatus } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../../../core/dto";

/**
 * Update timesheets status request DTO validation
 */
export class UpdateTimesheetStatusDTO extends TenantOrganizationBaseDTO
	implements IUpdateTimesheetStatusInput {

    @ApiProperty({ type: () => Array, readOnly: true })
	@ArrayNotEmpty()
    readonly ids: string[] = [];

	@ApiProperty({ type: () => String, enum: TimesheetStatus, readOnly: true })
	@IsEnum(TimesheetStatus)
	readonly status: TimesheetStatus;
}