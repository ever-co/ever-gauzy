import { IntersectionType } from '@nestjs/swagger';
import { IGetTimeSlotInput } from '@gauzy/contracts';
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from '../../../shared/dto';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/**
 * Get time slot request DTO validation
 */
export class TimeSlotQueryDTO
	extends IntersectionType(TenantOrganizationBaseDTO, FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO)
	implements IGetTimeSlotInput {}
