import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { ITimerToggleInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TimeLog } from '../../time-log/time-log.entity';
import { IsOptional, IsString } from 'class-validator';

export class StartTimerDTO
	extends IntersectionType(
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
	)
	implements ITimerToggleInput
{
	@ApiPropertyOptional({ example: 'Europe/Warsaw' })
	@IsOptional()
	@IsString()
	readonly timeZone?: string;
}
