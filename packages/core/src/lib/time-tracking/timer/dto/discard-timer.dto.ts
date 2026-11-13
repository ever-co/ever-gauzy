import { ITimerDiscardInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { StopTimerDTO } from './stop-timer.dto';

/**
 * The discard body: the organization, as every timer write sends it, and the running time log the discard is for
 * (`timeLogId`) when the client names it.
 */
export class DiscardTimerDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(StopTimerDTO, ['timeLogId'] as const))
	implements ITimerDiscardInput {}
