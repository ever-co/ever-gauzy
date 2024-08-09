import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ILastLoginAtInput } from '@gauzy/contracts';

/**
 * User last login timestamp input DTO validation
 */
export class UserLastLoginAtDTO implements ILastLoginAtInput {
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	readonly lastLoginAt?: Date;
}
