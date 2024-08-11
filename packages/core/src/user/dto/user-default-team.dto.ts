import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID, IDefaultTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserDefaultTeamDTO implements IDefaultTeam {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly defaultTeamId?: ID;
}
