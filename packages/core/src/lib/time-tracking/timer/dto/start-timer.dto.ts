import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';
import { ID, ITimerToggleInput } from '@gauzy/contracts';
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

	@ApiPropertyOptional({
		type: () => String,
		isArray: true,
		description:
			'The tags to file the run under: tags of the organization or of the whole tenant. A tag of another organization or tenant refuses the start (400), and nothing is written.'
	})
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tags?: ID[];

	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			"When true, a run with a project (the one named, else its task's) is billable as that project is set, a project with no setting counting as not billable; isBillable then applies only to a run without a project. Left out, isBillable decides as always."
	})
	@IsOptional()
	@IsBoolean()
	readonly billableFromProject?: boolean;
}
