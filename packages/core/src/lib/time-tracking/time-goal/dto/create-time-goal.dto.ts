import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, ITimeGoalCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TimeGoal } from '../time-goal.entity';
import { toIdList } from './id-list.transform';

/** The most projects, or clients, a goal may name. */
export const TIME_GOAL_MAX_FILTER_IDS = 100;

/**
 * Creates a time goal. Who it counts follows `scope`: `employeeId` for a member goal (the caller when absent),
 * `organizationTeamId` for a team goal, neither for an organization goal.
 */
export class CreateTimeGoalDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(TimeGoal, [
			'name',
			'comparison',
			'targetHours',
			'period',
			'scope',
			'billableOnly',
			'employeeId',
			'organizationTeamId'
		] as const)
	)
	implements ITimeGoalCreateInput
{
	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@Transform(toIdList)
	@IsArray()
	@ArrayMaxSize(TIME_GOAL_MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	readonly projectIds?: ID[];

	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@Transform(toIdList)
	@IsArray()
	@ArrayMaxSize(TIME_GOAL_MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	readonly organizationContactIds?: ID[];
}
