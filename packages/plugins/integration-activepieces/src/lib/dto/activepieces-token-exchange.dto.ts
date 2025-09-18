import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ActivepiecesTokenExchangeDto {
	@ApiProperty({
		description: 'Authorization code received from OAuth callback',
		type: String
	})
	@IsString()
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly code!: string;

	@ApiProperty({
		description: 'State parameter for CSRF protection',
		type: String
	})
	@IsString()
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly state!: string;
}
