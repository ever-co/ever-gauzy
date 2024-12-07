import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty } from 'class-validator';
import { ID, IDeleteTimeSlot } from '@gauzy/contracts';
import { ForceDeleteBaseDTO } from '../../../core/dto';
import { TimeSlot } from '../time-slot.entity';

/**
 * Data Transfer Object (DTO) for deleting time slots with the `forceDelete` flag.
 * This DTO extends the `ForceDeleteBaseDTO` to include the `forceDelete` flag.
 */
export class DeleteTimeSlotDTO extends ForceDeleteBaseDTO<TimeSlot> implements IDeleteTimeSlot {
	/**
	 * An array of IDs representing the time slots to be deleted.
	 * This array must not be empty and ensures that at least one time slot is selected for deletion.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly ids: ID[] = [];
}
