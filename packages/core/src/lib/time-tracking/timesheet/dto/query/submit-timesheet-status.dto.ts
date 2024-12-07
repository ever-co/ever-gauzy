import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsEnum, IsNotEmpty } from 'class-validator';
import { ID, ISubmitTimesheetInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../../core/dto';

/**
 * Submit timesheets status request DTO validation
 */
export class SubmitTimesheetStatusDTO extends TenantOrganizationBaseDTO implements ISubmitTimesheetInput {
	@ApiProperty({ description: 'Array of timesheet IDs to submit/unsubmit' })
	@ArrayNotEmpty({ message: 'At least one timesheet ID must be provided' })
	readonly ids: ID[];

	@ApiProperty({
		enum: ['submit', 'unsubmit'],
		description: 'Status to set on the timesheet (either "submit" or "unsubmit")'
	})
	@IsEnum(['submit', 'unsubmit'], { message: 'Status must be either "submit" or "unsubmit"' })
	@IsNotEmpty({ message: 'Status must not be empty' })
	readonly status: 'submit' | 'unsubmit' = 'submit';
}
