import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ID, ISubmitTimesheetInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../../core/dto';
import { MAX_TIMESHEET_STATUS_IDS } from './timesheet-status-ids.constant';

/**
 * Submit timesheets status request DTO validation
 */
export class SubmitTimesheetStatusDTO extends TenantOrganizationBaseDTO implements ISubmitTimesheetInput {
	@ApiProperty({ description: 'Array of timesheet IDs to submit/unsubmit', maxItems: MAX_TIMESHEET_STATUS_IDS })
	@ArrayNotEmpty({ message: 'At least one timesheet ID must be provided' })
	@ArrayMaxSize(MAX_TIMESHEET_STATUS_IDS)
	@IsUUID('all', { each: true })
	readonly ids: ID[];

	@ApiProperty({
		enum: ['submit', 'unsubmit'],
		description: 'Status to set on the timesheet (either "submit" or "unsubmit")'
	})
	@IsEnum(['submit', 'unsubmit'], { message: 'Status must be either "submit" or "unsubmit"' })
	@IsNotEmpty({ message: 'Status must not be empty' })
	readonly status: 'submit' | 'unsubmit' = 'submit';
}
