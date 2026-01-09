import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ICloudinaryConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

export class CloudinaryConfigDTO implements ICloudinaryConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Trimmed()
	readonly cloudinary_cloud_name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly cloudinary_api_key?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly cloudinary_api_secret?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly cloudinary_cdn_url?: string;
}
