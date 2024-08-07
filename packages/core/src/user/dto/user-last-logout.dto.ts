import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ILastLogoutAtInput } from '@gauzy/contracts';

/**
 * User last logout timestamp input DTO validation
 */
export class UserLogoutAtDTO implements ILastLogoutAtInput {
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	readonly lastLogoutAt?: Date;
}
