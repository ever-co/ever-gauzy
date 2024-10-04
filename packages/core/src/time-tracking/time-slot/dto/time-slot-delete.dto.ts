import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty } from 'class-validator';
import { ID, IDeleteTimeSlot } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class TimeSlotDeleteDTO extends TenantOrganizationBaseDTO implements IDeleteTimeSlot {
	/**
	 * An array of IDs representing the time slots to be deleted.
	 * This array must not be empty and ensures that at least one time slot is selected for deletion.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly ids: ID[] = [];
}
