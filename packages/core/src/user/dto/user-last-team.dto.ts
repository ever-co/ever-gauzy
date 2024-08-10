import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ILastTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastTeamDTO implements ILastTeam {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly lastTeamId?: string;
}
