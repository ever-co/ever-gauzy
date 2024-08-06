import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ILastTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastTeamDTO implements ILastTeam {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly lastTeamId: string;
}
