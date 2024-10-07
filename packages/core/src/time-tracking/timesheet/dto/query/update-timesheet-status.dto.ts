import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { ArrayNotEmpty } from 'class-validator';
import { ID, IUpdateTimesheetStatusInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../../core/dto';
import { Timesheet } from '../../timesheet.entity';

/**
 * Update timesheets status request DTO validation
 */
export class UpdateTimesheetStatusDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(Timesheet, ['status'] as const))
	implements IUpdateTimesheetStatusInput
{
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	ids: ID[] = [];
}
