import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	refresh_token: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	clientId: string;
}
