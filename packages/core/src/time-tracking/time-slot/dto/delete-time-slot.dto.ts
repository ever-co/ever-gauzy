import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty } from 'class-validator';
import { ID, IDeleteTimeSlot } from '@gauzy/contracts';
import { ForceDeleteDTO } from '../../dto/force-delete.dto';
import { TimeSlot } from '../time-slot.entity';

export class DeleteTimeSlotDTO extends ForceDeleteDTO<TimeSlot> implements IDeleteTimeSlot {
	/**
	 * An array of IDs representing the time slots to be deleted.
	 * This array must not be empty and ensures that at least one time slot is selected for deletion.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly ids: ID[] = [];
}
