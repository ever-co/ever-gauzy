import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { ITimeGoalUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TimeGoal } from '../time-goal.entity';
import { CreateTimeGoalDTO } from './create-time-goal.dto';

/**
 * Changes what a time goal asks for. Who it counts (`scope`, `employeeId`, `organizationTeamId`) is set at creation.
 * A list of projects or clients replaces the goal's when sent, and an empty list counts every project or client.
 */
export class UpdateTimeGoalDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(
			// A field may be left out, never sent as null: `skipNullProperties: false` validates a null.
			PartialType(PickType(TimeGoal, ['name', 'comparison', 'targetHours', 'period', 'billableOnly'] as const), {
				skipNullProperties: false
			}),
			PickType(CreateTimeGoalDTO, ['projectIds', 'organizationContactIds'] as const)
		)
	)
	implements ITimeGoalUpdateInput {}
