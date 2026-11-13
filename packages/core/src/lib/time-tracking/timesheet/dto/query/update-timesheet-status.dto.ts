import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsUUID } from 'class-validator';
import { ID, IUpdateTimesheetStatusInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../../core/dto';
import { Timesheet } from '../../timesheet.entity';
import { MAX_TIMESHEET_STATUS_IDS } from './timesheet-status-ids.constant';

/**
 * Update timesheets status request DTO validation
 */
export class UpdateTimesheetStatusDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(Timesheet, ['status', 'reason'] as const))
	implements IUpdateTimesheetStatusInput
{
	@ApiProperty({ type: () => Array, maxItems: MAX_TIMESHEET_STATUS_IDS })
	@ArrayNotEmpty()
	@ArrayMaxSize(MAX_TIMESHEET_STATUS_IDS)
	@IsUUID('all', { each: true })
	ids: ID[];
}
