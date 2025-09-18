import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class ActivepiecesTokenExchangeDto {
	@ApiProperty({
		description: 'Authorization code received from OAuth callback',
		type: String
	})
	@IsString()
	@IsNotEmpty()
	readonly code!: string;

	@ApiProperty({
		description: 'State parameter for CSRF protection',
		type: String
	})
	@IsString()
	@IsNotEmpty()
	readonly state!: string;
}
