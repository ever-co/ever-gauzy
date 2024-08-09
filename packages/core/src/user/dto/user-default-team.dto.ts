import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IDefaultTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserDefaultTeamDTO implements IDefaultTeam {
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly defaultTeamId?: string;
}
