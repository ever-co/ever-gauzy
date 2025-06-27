import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ID, IDeleteTimeLog, IDeleteTimeLogData, TimeLogPartialStatus } from '@gauzy/contracts';
import { ForceDeleteBaseDTO } from '../../../core/dto';
import { TimeLog } from '../time-log.entity';


class DeleteTimeLogDataDTO implements IDeleteTimeLogData {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	readonly id: ID;

	@ApiProperty({ type: () => Number })
	@IsEnum(TimeLogPartialStatus)
	@IsNotEmpty()
	readonly partialStatus: TimeLogPartialStatus;

	@ApiProperty({ type: () => Date })
	@IsDateString()
	@IsNotEmpty()
	readonly referenceDate: Date;
}

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
	readonly logs: DeleteTimeLogDataDTO[] = [];
}
