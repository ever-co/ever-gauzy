import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsNotEmpty } from "class-validator";
import { ISubmitTimesheetInput } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "../../../../core/dto";

/**
 * Submit timesheets status request DTO validation
 */
export class SubmitTimesheetStatusDTO extends TenantOrganizationBaseDTO
	implements ISubmitTimesheetInput {

    @ApiProperty({ type: () => Array, readOnly: true })
	@ArrayNotEmpty()
    readonly ids: string[] = [];

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	readonly status: 'submit' | 'unsubmit' = 'submit';
}