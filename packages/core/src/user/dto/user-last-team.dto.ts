import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ILastTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastTeamDTO implements ILastTeam {
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	readonly lastTeamId?: string;
}
