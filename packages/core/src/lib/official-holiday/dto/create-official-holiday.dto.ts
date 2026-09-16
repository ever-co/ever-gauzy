import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IOfficialHolidayCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OfficialHoliday } from '../official-holiday.entity';

/**
 * Create Official Holiday request DTO.
 */
export class CreateOfficialHolidayDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(OfficialHoliday, ['organizationId', 'tenantId'] as const)
	)
	implements IOfficialHolidayCreateInput {}
