import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ITimeGoalFindInput } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TimeGoal } from '../time-goal.entity';

/**
 * Lists the time goals the caller may read in an organization, archived ones only when asked.
 */
export class TimeGoalQueryDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PartialType(PickType(TimeGoal, ['employeeId', 'organizationTeamId', 'scope'] as const))
	)
	implements ITimeGoalFindInput
{
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly includeArchived?: boolean = false;
}
