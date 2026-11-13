import { ID, ITimerToggleInput } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { StartTimerDTO } from './start-timer.dto';

export class StopTimerDTO
	extends IntersectionType(StartTimerDTO, PartialType(PickType(StartTimerDTO, ['source', 'logType'] as const)))
	implements ITimerToggleInput
{
	@ApiPropertyOptional({
		type: () => String,
		format: 'uuid',
		description:
			'The running time log a stop or a toggle is for, as the client last saw it. When another log is the running one, the call answers 409 and that log goes on.'
	})
	@IsOptional()
	@IsUUID()
	readonly timeLogId?: ID;
}
