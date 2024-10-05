import { IntersectionType } from '@nestjs/swagger';
import { IGetTimeSlotInput } from '@gauzy/contracts';
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from '../../../shared/dto';

/**
 * Get time slot request DTO validation
 */
export class TimeSlotQueryDTO
	extends IntersectionType(FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO)
	implements IGetTimeSlotInput {}
