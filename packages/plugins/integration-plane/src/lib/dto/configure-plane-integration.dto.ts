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
		description: 'Plane admin panel URL (optional; not used in shared mode)',
		example: 'https://admin.plane.example.com'
	})
	// Admin URL is always optional. Validate the URL only when a non-empty value is
	// supplied, so a blank string (common from a cleared form field) is treated as
	// absent instead of failing @IsUrl — which would 400 an otherwise-valid request.
	@ValidateIf((o) => o.planeAdminUrl != null && o.planeAdminUrl !== '')
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly planeAdminUrl?: string;

	@ApiPropertyOptional({
		description: 'Plane public space URL (required in custom mode)',
		example: 'https://space.plane.example.com'
	})
	// Required (and validated) only in custom mode; in shared mode the space URL is
	// irrelevant, so validation is skipped and a blank/absent value is accepted.
	@ValidateIf((o) => o.mode === 'custom')
	@IsNotEmpty()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly planeSpaceUrl?: string;
}
