import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ActivepiecesTokenExchangeDto {
	@ApiProperty({
		description: 'Authorization code received from OAuth callback',
		type: String,
		maxLength: 2048
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(2048)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly code!: string;

	@ApiProperty({
		description: 'State parameter for CSRF protection',
		type: String,
		maxLength: 512
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(512)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly state!: string;
}
