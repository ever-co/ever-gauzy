import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { IActivity, ID } from '@gauzy/contracts';

/**
 * Body of PUT /timesheet/time-slot/:id.
 *
 * Declares exactly what the timer clients send (the desktop timer sends duration, keyboard, mouse,
 * overall and activities), so `whitelist: true` drops everything else — tenantId, organizationId,
 * relation objects — before it can reach the update (GHSA-6qvm-3wg4-26w4). The value checks are left
 * loose on purpose: the endpoint accepted these fields unvalidated before, and old desktop builds
 * must keep working. The handler still picks its own allow-list.
 */
export class UpdateTimeSlotDTO {
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly duration?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly keyboard?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly mouse?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly overall?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly location?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	startedAt?: Date;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly kbMouseActivity?: any;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly locationActivity?: any;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly customActivity?: any;

	/**
	 * Only narrows which time slot is addressed, and only for callers holding
	 * CHANGE_SELECTED_EMPLOYEE. It is never written.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly employeeId?: ID;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	activities?: IActivity[];
}
