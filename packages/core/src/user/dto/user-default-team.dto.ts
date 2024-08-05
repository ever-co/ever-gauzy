import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IDefaultTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserDefaultTeamDTO implements IDefaultTeam {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly defaultTeamId: string;
}
