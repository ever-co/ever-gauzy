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
		description: 'OAuth grant type',
		enum: ['authorization_code'],
		default: 'authorization_code'
	})
	@IsEnum(['authorization_code'])
	readonly grant_type: 'authorization_code' = 'authorization_code';
}
