import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl, ValidateIf } from 'class-validator';
import { FileStorageProviderEnum, IDigitalOceanFileStorageProviderConfig } from '@gauzy/contracts';
import { IsSecret } from '../../../core/decorators';
import { Trimmed } from '../../../shared/decorators/trim.decorator';

/**
 * DigitalOcean S3 FileStorage Provider Configuration DTO validation
 */
export class DigitalOceanS3ProviderConfigDTO implements IDigitalOceanFileStorageProviderConfig {
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly digitalocean_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly digitalocean_secret_access_key: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsString()
	@Trimmed()
	readonly digitalocean_s3_bucket: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly digitalocean_service_url: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly digitalocean_cdn_url: string;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsOptional()
	@IsString()
	readonly digitalocean_default_region: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.DIGITALOCEAN)
	@IsOptional()
	@IsBoolean()
	readonly digitalocean_s3_force_path_style: boolean;
}
