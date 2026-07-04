import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

/**
 * DTO for configuring Plane integration with tenant-specific URLs.
 */
export class ConfigurePlaneIntegrationDto {
	@ApiPropertyOptional({
		description: 'Integration mode: "shared" uses the global hosted Ever Gauzy PM UIs, "custom" uses tenant-provided URLs',
		enum: ['shared', 'custom'],
		example: 'shared'
	})
	@IsOptional()
	@IsIn(['shared', 'custom'])
	readonly mode?: 'shared' | 'custom';

	@ApiProperty({
		description: 'Main Plane web app URL (required only in custom mode)',
		example: 'https://plane.example.com'
	})
	@ValidateIf((o) => o.mode === 'custom')
	@IsNotEmpty()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly planeWebUrl!: string;

	@ApiPropertyOptional({
		description: 'Plane admin panel URL',
		example: 'https://admin.plane.example.com'
	})
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly planeAdminUrl?: string;

	@ApiPropertyOptional({
		description: 'Plane public space URL',
		example: 'https://space.plane.example.com'
	})
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly planeSpaceUrl?: string;
}
