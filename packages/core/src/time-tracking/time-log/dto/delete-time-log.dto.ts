import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty } from 'class-validator';
import { ID, IDeleteTimeLog } from '@gauzy/contracts';
import { ForceDeleteBaseDTO } from '../../../core/dto';
import { TimeLog } from '../time-log.entity';

/**
 * Data Transfer Object (DTO) for deleting time logs with the `forceDelete` flag.
 * This DTO extends the `ForceDeleteBaseDTO` to include the `forceDelete` flag.
 */
export class DeleteTimeLogDTO extends ForceDeleteBaseDTO<TimeLog> implements IDeleteTimeLog {
	/**
	 * An array of time log IDs that need to be deleted.
	 * This field is required and must contain at least one ID.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly logIds: ID[] = [];
}
