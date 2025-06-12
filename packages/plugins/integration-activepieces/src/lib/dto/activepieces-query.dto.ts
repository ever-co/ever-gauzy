import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ActivepiecesQueryDTO {
	@ApiProperty({
		description: 'The state parameter for CSRF protection',
		required: false,
		type: String
	})
	@IsOptional()
	@IsString()
	readonly state?: string;

	@ApiProperty({
		description: 'The authorization code received from ActivePieces',
		required: false,
		type: String
	})
	@IsOptional()
	@IsString()
	readonly code?: string;
}
