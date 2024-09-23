import { ITimerToggleInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { StartTimerDTO } from './start-timer.dto';

export class StopTimerDTO
	extends IntersectionType(StartTimerDTO, PartialType(PickType(StartTimerDTO, ['source', 'logType'] as const)))
	implements ITimerToggleInput {}
