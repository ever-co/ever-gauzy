import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * DTO for configuring Plane integration with tenant-specific URLs.
 */
export class ConfigurePlaneIntegrationDto {
	@ApiProperty({
		description: 'Main Plane web app URL',
		example: 'https://plane.example.com'
	})
	@IsNotEmpty()
	@IsString()
	@IsUrl({ require_tld: false })
	readonly planeWebUrl!: string;

	@ApiPropertyOptional({
		description: 'Plane admin panel URL',
		example: 'https://admin.plane.example.com'
	})
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false })
	readonly planeAdminUrl?: string;

	@ApiPropertyOptional({
		description: 'Plane public space URL',
		example: 'https://space.plane.example.com'
	})
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false })
	readonly planeSpaceUrl?: string;
}
