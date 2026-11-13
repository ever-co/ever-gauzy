import { ITimerToggleInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { StartTimerDTO } from './start-timer.dto';
import { StopTimerDTO } from './stop-timer.dto';

/**
 * The toggle body: the start's, and the running time log a stop names (`timeLogId`), since a toggle stops the timer
 * when one runs.
 */
export class ToggleTimerDTO
	extends IntersectionType(StartTimerDTO, PickType(StopTimerDTO, ['timeLogId'] as const))
	implements ITimerToggleInput {}
