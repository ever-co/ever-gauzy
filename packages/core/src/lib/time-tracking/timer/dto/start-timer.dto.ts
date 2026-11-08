import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { ITimerToggleInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TimeLog } from '../../time-log/time-log.entity';

export class StartTimerDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(TimeLog, [
	  'source',
	  'logType',
	  'isBillable',
	  'description',
	  'version',
	  'organizationTeamId',
	  'organizationContactId',
	  'projectId',
	  'taskId'
	] as const)
  ) implements ITimerToggleInput {
	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-05',
		description:
			"The member's current day. When the team requires a daily plan, an Ever Teams start needs a plan for that day. Ignored unless it is today somewhere."
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	readonly planDay?: string;
}
