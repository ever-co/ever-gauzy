import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IGoogleMapsConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

/**
 * Google Maps Configuration DTO validation
 */
export class GoogleMapsConfigDTO implements IGoogleMapsConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly google_maps_api_key?: string;
}
