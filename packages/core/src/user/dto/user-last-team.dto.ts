import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ILastTeam } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastTeamDTO implements ILastTeam {
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly lastTeamId?: string;
}
